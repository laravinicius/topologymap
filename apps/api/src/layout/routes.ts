import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { isPlanLayout, type PlanLayout } from '@topologia-new/domain';
import { HttpError } from '../auth/authorization.js';

const uuid = { type: 'string', format: 'uuid' };
const params = { type: 'object', required: ['companyId', 'planId'], additionalProperties: false, properties: { companyId: uuid, planId: uuid } };
const body = { type: 'object', required: ['expectedRevision', 'layout'], additionalProperties: false,
  properties: { expectedRevision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, layout: { type: 'object' },
    newSectorIds: { type: 'array', uniqueItems: true, items: uuid } } };
type Params = { companyId: string; planId: string };
type Input = { expectedRevision: number; layout: PlanLayout; newSectorIds?: string[] };
type LayoutRow = { revision: string; geometry: PlanLayout['geometry']; camera: PlanLayout['camera'] };
const parseRevision = (value: string) => Number(value);

export function registerLayout(app: FastifyInstance, pool: pg.Pool) {
  // Vincular um cadastro é uma operação explícita, fora do histórico de posições.
  app.post<{ Params: Params & { rackId: string }; Body: { expectedRevision: number } }>('/api/companies/:companyId/plans/:planId/racks/:rackId', {
    config: { access: 'company' }, schema: {
      params: { ...params, required: [...params.required, 'rackId'], properties: { ...params.properties, rackId: uuid } },
      body: { type: 'object', required: ['expectedRevision'], additionalProperties: false, properties: { expectedRevision: body.properties.expectedRevision } },
    },
  }, async request => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const plan = await client.query<{ unit_id: string; revision: string }>('SELECT unit_id,revision::text FROM plans WHERE company_id=$1 AND id=$2 FOR UPDATE', [request.company!.id, request.params.planId]);
      if (!plan.rowCount) throw new HttpError(404, 'Planta não encontrada nesta empresa.');
      if (Number(plan.rows[0]!.revision) !== request.body.expectedRevision) throw new HttpError(409, 'A revisão da planta mudou. Atualize antes de vincular o rack.');
      const rack = await client.query<{ plan_id: string | null }>('SELECT plan_id FROM racks WHERE company_id=$1 AND unit_id=$2 AND id=$3 FOR NO KEY UPDATE NOWAIT', [request.company!.id, plan.rows[0]!.unit_id, request.params.rackId]);
      if (!rack.rowCount) throw new HttpError(404, 'Rack não encontrado nesta unidade.');
      if (rack.rows[0]!.plan_id !== null) throw new HttpError(409, 'Este rack já está vinculado a uma planta. Atualize a lista.');
      await client.query('UPDATE racks SET plan_id=$3 WHERE company_id=$1 AND id=$2', [request.company!.id, request.params.rackId, request.params.planId]);
      const updated = await client.query('SELECT revision::text FROM plans WHERE company_id=$1 AND id=$2', [request.company!.id, request.params.planId]);
      await client.query('COMMIT');
      return { revision: Number(updated.rows[0]!.revision) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (['55P03', '40P01'].includes((error as { code?: string }).code ?? '')) throw new HttpError(409, 'Um cadastro está em edição. Aguarde e atualize antes de vincular.');
      throw error;
    } finally { client.release(); }
  });

  app.get<{ Params: Params }>('/api/companies/:companyId/plans/:planId/layout', { config: { access: 'company' }, schema: { params } }, async request => {
    const result = await pool.query<LayoutRow>(`SELECT p.revision::text,p.geometry,p.camera,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'placement',d.placement,'sectorId',d.sector_id) ORDER BY d.id) FROM desks d WHERE d.company_id=p.company_id AND d.plan_id=p.id),'[]') desks,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'placement',r.placement) ORDER BY r.id) FROM racks r WHERE r.company_id=p.company_id AND r.plan_id=p.id),'[]') racks,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'polygon',s.polygon,'name',s.name) ORDER BY s.id) FROM sectors s WHERE s.company_id=p.company_id AND s.plan_id=p.id),'[]') sectors
      FROM plans p WHERE p.company_id=$1 AND p.id=$2`, [request.company!.id, request.params.planId]);
    if (!result.rowCount) throw new HttpError(404, 'Planta não encontrada nesta empresa.');
    const row = result.rows[0] as LayoutRow & { desks: unknown[]; racks: unknown[]; sectors: unknown[] };
    return { revision: parseRevision(row.revision), layout: { version: 1, unit: 'm', geometry: row.geometry, camera: row.camera, desks: row.desks, racks: row.racks, sectors: row.sectors } };
  });

  app.put<{ Params: Params; Body: Input }>('/api/companies/:companyId/plans/:planId/layout', { bodyLimit: 1024 * 1024, config: { access: 'company' }, schema: { params, body } }, async request => {
    if (!isPlanLayout(request.body.layout)) throw new HttpError(400, 'Documento de layout inválido: IDs UUID únicos, geometria v1 em metros e câmera/posições válidas são obrigatórios.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const plan = await client.query<LayoutRow>('SELECT revision::text,geometry,camera FROM plans WHERE company_id=$1 AND id=$2 FOR UPDATE', [request.company!.id, request.params.planId]);
      if (!plan.rowCount) throw new HttpError(404, 'Planta não encontrada nesta empresa.');
      const currentRevision = parseRevision(plan.rows[0]!.revision);
      if (currentRevision !== request.body.expectedRevision) throw new HttpError(409, 'O layout foi alterado desde a leitura. Atualize antes de salvar.');
      const background = request.body.layout.geometry.background;
      const existingBackground = plan.rows[0]!.geometry.background;
      if (background && (!existingBackground || background.originalFileId !== existingBackground.originalFileId
        || background.renderedFileId !== existingBackground.renderedFileId))
        throw new HttpError(400, 'Novas referências de arquivos de fundo exigem a importação e validação de arquivos da etapa 14.');
      // O cadastro bloqueia primeiro o objeto e depois avança a revisão da planta.
      // Não aguardar seus locks na ordem inversa: rejeitar o conflito sem deadlock.
      const idSets = [];
      for (const table of ['desks', 'racks', 'sectors']) {
        idSets.push(await client.query<{ id: string }>(`SELECT id FROM ${table} WHERE company_id=$1 AND plan_id=$2 ORDER BY id FOR NO KEY UPDATE NOWAIT`, [request.company!.id, request.params.planId]));
      }
      const submitted = [request.body.layout.desks, request.body.layout.racks, request.body.layout.sectors];
      for (let i = 0; i < 2; i++) {
        const actual = idSets[i]!.rows.map(row => row.id).sort();
        const received = submitted[i]!.map(item => item.id.toLowerCase()).sort();
        if (actual.length !== received.length || actual.some((id, index) => id !== received[index]))
          throw new HttpError(409, 'Os cadastros da planta mudaram desde a leitura. Atualize o layout para preservar as referências atuais.');
      }
      const existingSectors = new Set(idSets[2]!.rows.map(row => row.id));
      const newIds = new Set((request.body.newSectorIds ?? []).map(id => id.toLowerCase()));
      const sectors = request.body.layout.sectors;
      if (newIds.size !== (request.body.newSectorIds ?? []).length
        || [...newIds].some(id => existingSectors.has(id) || !sectors.some(s => s.id.toLowerCase() === id))
        || sectors.some(s => !existingSectors.has(s.id.toLowerCase()) && (!newIds.has(s.id.toLowerCase()) || !s.name)))
        throw new HttpError(409, 'Setores novos exigem criação explícita; atualize referências desatualizadas.');
      if (newIds.size && (await client.query('SELECT id FROM sectors WHERE id=ANY($1::uuid[])', [[...newIds]])).rowCount)
        throw new HttpError(409, 'Um ID de setor já está em uso. Atualize a planta.');
      await client.query("SELECT set_config('topologia.layout_save','on',true)");
      // Desvincular primeiro; a FK RESTRICT impede apagar setores com mesas.
      const keptIds = sectors.map(s => s.id);
      await client.query('UPDATE desks SET sector_id=NULL WHERE company_id=$1 AND plan_id=$2 AND sector_id IS NOT NULL AND NOT (sector_id=ANY($3::uuid[]))', [request.company!.id, request.params.planId, keptIds]);
      await client.query('DELETE FROM sectors WHERE company_id=$1 AND plan_id=$2 AND NOT (id=ANY($3::uuid[]))', [request.company!.id, request.params.planId, keptIds]);
      // A unicidade diferida permite trocar nomes entre setores numa única gravação.
      await client.query('SET CONSTRAINTS sectors_plan_id_name_key DEFERRED');
      for (const item of sectors) {
        if (newIds.has(item.id.toLowerCase())) {
          await client.query('INSERT INTO sectors(id,company_id,plan_id,name,polygon) VALUES ($1,$2,$3,$4,$5::jsonb)', [item.id, request.company!.id, request.params.planId, item.name, JSON.stringify(item.polygon)]);
        } else {
          await client.query('UPDATE sectors SET polygon=$3::jsonb,name=coalesce($5,name) WHERE company_id=$1 AND plan_id=$2 AND id=$4', [request.company!.id, request.params.planId, JSON.stringify(item.polygon), item.id, item.name ?? null]);
        }
      }
      for (const item of request.body.layout.desks) {
        const result = await client.query('UPDATE desks SET placement=$3::jsonb,sector_id=CASE WHEN $5 THEN $6::uuid ELSE sector_id END WHERE company_id=$1 AND plan_id=$2 AND id=$4', [request.company!.id, request.params.planId, JSON.stringify(item.placement), item.id, item.sectorId !== undefined, item.sectorId ?? null]);
        if (!result.rowCount) throw new HttpError(409, 'Uma mesa mudou de planta durante o salvamento. Atualize o layout.');
      }
      for (const item of request.body.layout.racks) {
        const result = await client.query('UPDATE racks SET placement=$3::jsonb WHERE company_id=$1 AND plan_id=$2 AND id=$4', [request.company!.id, request.params.planId, item.placement === null ? null : JSON.stringify(item.placement), item.id]);
        if (!result.rowCount) throw new HttpError(409, 'Um rack mudou de planta durante o salvamento. Atualize o layout.');
      }
      const updated = await client.query('UPDATE plans SET geometry=$3::jsonb,camera=$4::jsonb,revision=revision+1 WHERE company_id=$1 AND id=$2 AND revision=$5 RETURNING revision::text', [request.company!.id, request.params.planId, JSON.stringify(request.body.layout.geometry), JSON.stringify(request.body.layout.camera), request.body.expectedRevision]);
      if (!updated.rowCount) throw new HttpError(409, 'O layout foi alterado durante o salvamento. Atualize antes de salvar.');
      await client.query('COMMIT');
      return { revision: parseRevision(updated.rows[0]!.revision) };
    } catch (error) {
      await client.query('ROLLBACK');
      if (['55P03', '40P01'].includes((error as { code?: string }).code ?? ''))
        throw new HttpError(409, 'Um cadastro da planta está sendo alterado. Aguarde e atualize o layout antes de salvar.');
      if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Nomes de setores devem ser únicos na planta; confira também os IDs.');
      throw error;
    } finally { client.release(); }
  });
}
