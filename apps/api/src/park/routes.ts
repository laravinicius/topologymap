import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NamedInput, UnitInput } from '@topologia-new/domain';
import { HttpError } from '../auth/authorization.js';
import { uuid } from '../admin/routes.js';

const name = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const company = { access: 'company' as const };
const paramsSchema = (keys: string[]) => ({ type: 'object', required: keys, additionalProperties: false,
  properties: Object.fromEntries(keys.map(key => [key, uuid])) });
const baseFields = 'id,name,company_id AS "companyId",created_at AS "createdAt",updated_at AS "updatedAt"';
// Tabelas/colunas vêm exclusivamente desta lista interna, nunca da requisição.
const resources = [
  { table: 'units', path: '/units', keys: ['companyId'], columns: ['company_id'], idKey: 'unitId', fields: `${baseFields},classification` },
  { table: 'floors', path: '/units/:unitId/floors', keys: ['companyId', 'unitId'], columns: ['company_id', 'unit_id'], idKey: 'floorId', fields: `${baseFields},unit_id AS "unitId"` },
  { table: 'plans', path: '/units/:unitId/floors/:floorId/plans', keys: ['companyId', 'unitId', 'floorId'], columns: ['company_id', 'unit_id', 'floor_id'], idKey: 'planId', fields: `${baseFields},unit_id AS "unitId",floor_id AS "floorId"` },
  { table: 'datacenters', path: '/units/:unitId/datacenters', keys: ['companyId', 'unitId'], columns: ['company_id', 'unit_id'], idKey: 'datacenterId', fields: `${baseFields},unit_id AS "unitId"` },
] as const;
type Context = { companyId: string; unitId?: string; floorId?: string; planId?: string; datacenterId?: string };

export function registerPark(app: FastifyInstance, pool: pg.Pool) {
  // Um único statement garante um snapshot consistente da hierarquia durante alterações concorrentes.
  app.get('/api/companies/:companyId/park', { config: company, schema: { params: paramsSchema(['companyId']) } }, async request => {
    const result = await pool.query(`SELECT
      coalesce((SELECT jsonb_agg(v ORDER BY v.name,v.id) FROM (SELECT ${resources[0].fields} FROM units WHERE company_id=$1) v),'[]') AS units,
      coalesce((SELECT jsonb_agg(v ORDER BY v.name,v.id) FROM (SELECT ${resources[1].fields} FROM floors WHERE company_id=$1) v),'[]') AS floors,
      coalesce((SELECT jsonb_agg(v ORDER BY v.name,v.id) FROM (SELECT ${resources[2].fields} FROM plans WHERE company_id=$1) v),'[]') AS plans,
      coalesce((SELECT jsonb_agg(v ORDER BY v.name,v.id) FROM (SELECT ${resources[3].fields} FROM datacenters WHERE company_id=$1) v),'[]') AS datacenters`, [request.company!.id]);
    return { company: request.company, ...result.rows[0] };
  });

  for (const resource of resources) {
    const path = `/api/companies/:companyId${resource.path}`;
    const detail = `${path}/:${resource.idKey}`;
    const keys = [...resource.keys];
    const listParams = paramsSchema(keys), itemParams = paramsSchema([...keys, resource.idKey]);
    const properties = resource.table === 'units' ? { name, classification: name } : { name };
    const createBody = { type: 'object', required: Object.keys(properties), additionalProperties: false, properties };
    const updateBody = { type: 'object', minProperties: 1, additionalProperties: false, properties };
    const where = resource.columns.map((column, i) => `${column}=$${i + 1}`).join(' AND ');
    const itemWhere = `${where} AND id=$${keys.length + 1}`;
    const values = (context: Context, companyId: string) => keys.map(key => key === 'companyId' ? companyId : context[key as keyof Context]);
    async function parent(context: Context, companyId: string) {
      if (context.floorId) {
        if (!(await pool.query('SELECT id FROM floors WHERE company_id=$1 AND unit_id=$2 AND id=$3', [companyId, context.unitId, context.floorId])).rowCount)
          throw new HttpError(404, 'Andar não encontrado nesta unidade.');
      } else if (context.unitId) {
        if (!(await pool.query('SELECT id FROM units WHERE company_id=$1 AND id=$2', [companyId, context.unitId])).rowCount)
          throw new HttpError(404, 'Unidade não encontrada nesta empresa.');
      }
    }
    app.get<{ Params: Context }>(path, { config: company, schema: { params: listParams } }, async request => {
      await parent(request.params, request.company!.id);
      return { [resource.table]: (await pool.query(`SELECT ${resource.fields} FROM ${resource.table} WHERE ${where} ORDER BY name,id`, values(request.params, request.company!.id))).rows };
    });
    app.get<{ Params: Context }>(detail, { config: company, schema: { params: itemParams } }, async request => {
      const result = await pool.query(`SELECT ${resource.fields} FROM ${resource.table} WHERE ${itemWhere}`, [...values(request.params, request.company!.id), request.params[resource.idKey]]);
      if (!result.rowCount) throw new HttpError(404, 'Cadastro não encontrado neste contexto.');
      return result.rows[0];
    });
    app.post<{ Params: Context; Body: NamedInput | UnitInput }>(path, { config: company, schema: { params: listParams, body: createBody } }, async (request, reply) => {
      await parent(request.params, request.company!.id);
      const input = request.body;
      const columns = [...resource.columns, 'name', ...(resource.table === 'units' ? ['classification'] : [])];
      const data = [...values(request.params, request.company!.id), input.name, ...(resource.table === 'units' ? [(input as UnitInput).classification] : [])];
      const result = await pool.query(`INSERT INTO ${resource.table}(${columns.join(',')}) VALUES (${data.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${resource.fields}`, data);
      return reply.code(201).send(result.rows[0]);
    });
    app.patch<{ Params: Context; Body: Partial<UnitInput> }>(detail, { config: company, schema: { params: itemParams, body: updateBody } }, async request => {
      const data = [...values(request.params, request.company!.id), request.params[resource.idKey], request.body.name ?? null];
      let assignment = `name=coalesce($${data.length},name)`;
      if (resource.table === 'units') { data.push(request.body.classification ?? null); assignment += `,classification=coalesce($${data.length},classification)`; }
      const result = await pool.query(`UPDATE ${resource.table} SET ${assignment} WHERE ${itemWhere} RETURNING ${resource.fields}`, data);
      if (!result.rowCount) throw new HttpError(404, 'Cadastro não encontrado neste contexto.');
      return result.rows[0];
    });
    app.delete<{ Params: Context }>(detail, { config: company, schema: { params: itemParams } }, async (request, reply) => {
      // RESTRICT no banco protege todos os filhos, inclusive os cadastros das próximas etapas.
      try {
        const result = await pool.query(`DELETE FROM ${resource.table} WHERE ${itemWhere}`, [...values(request.params, request.company!.id), request.params[resource.idKey]]);
        if (!result.rowCount) throw new HttpError(404, 'Cadastro não encontrado neste contexto.');
      } catch (error) {
        if (['23503', '23001'].includes((error as { code?: string }).code ?? '')) throw new HttpError(409, 'Não é possível excluir: este cadastro possui dependências. Remova ou desvincule os dependentes primeiro.');
        throw error;
      }
      return reply.code(204).send();
    });
  }
}
