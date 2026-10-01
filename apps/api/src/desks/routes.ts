import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { deskLimits, type DeskCreateInput, type DeskUpdateInput } from '@topologia-new/domain';
import { HttpError } from '../auth/authorization.js';
import { uuid } from '../admin/routes.js';

type Context = { companyId: string; unitId: string; floorId: string; planId: string; deskId: string; pointId: string };
const name = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const count = { type: 'integer', minimum: 0, maximum: deskLimits.points };
const placement = { type: 'object', required: ['x', 'y', 'width', 'height', 'rotation'], additionalProperties: false,
  properties: { x: { type: 'number', minimum: -deskLimits.coordinate, maximum: deskLimits.coordinate },
    y: { type: 'number', minimum: -deskLimits.coordinate, maximum: deskLimits.coordinate },
    width: { type: 'number', exclusiveMinimum: 0, maximum: deskLimits.dimension },
    height: { type: 'number', exclusiveMinimum: 0, maximum: deskLimits.dimension },
    rotation: { type: 'number', minimum: 0, exclusiveMaximum: 360 } } };
const keys = ['companyId', 'unitId', 'floorId', 'planId'];
const params = (extra: string[] = []) => ({ type: 'object', required: [...keys, ...extra], additionalProperties: false,
  properties: Object.fromEntries([...keys, ...extra].map(key => [key, uuid])) });
const config = { access: 'company' as const };
const fields = 'd.id,d.name,d.company_id AS "companyId",d.plan_id AS "planId",d.sector_id AS "sectorId",d.placement,d.created_at AS "createdAt",d.updated_at AS "updatedAt"';
const pointsQuery = `SELECT p.id,p.name,p.company_id AS "companyId",p.desk_id AS "deskId",p.ordinal,
  p.created_at AS "createdAt",p.updated_at AS "updatedAt",c.id AS "connectionId"
  FROM points p LEFT JOIN connections c ON c.company_id=p.company_id AND c.point_id=p.id
  WHERE p.company_id=$1 AND p.desk_id=$2 ORDER BY p.ordinal,p.id`;

export function registerDesks(app: FastifyInstance, pool: pg.Pool) {
  const path = '/api/companies/:companyId/units/:unitId/floors/:floorId/plans/:planId/desks';
  const detail = `${path}/:deskId`, point = `${detail}/points/:pointId`;
  const context = (p: Context) => [p.companyId, p.unitId, p.floorId, p.planId];
  async function parent(db: pg.Pool | pg.PoolClient, p: Context) {
    if (!(await db.query('SELECT id FROM plans WHERE company_id=$1 AND unit_id=$2 AND floor_id=$3 AND id=$4', context(p))).rowCount)
      throw new HttpError(404, 'Planta não encontrada neste contexto.');
  }
  async function desk(db: pg.Pool | pg.PoolClient, p: Context, lock = false) {
    const result = await db.query(`SELECT ${fields} FROM desks d JOIN plans pl ON pl.company_id=d.company_id AND pl.id=d.plan_id
      WHERE d.company_id=$1 AND pl.unit_id=$2 AND pl.floor_id=$3 AND d.plan_id=$4 AND d.id=$5 ${lock ? 'FOR UPDATE OF d' : ''}`, [...context(p), p.deskId]);
    if (!result.rowCount) throw new HttpError(404, 'Mesa não encontrada nesta planta.');
    return result.rows[0];
  }
  async function transaction<T>(work: (db: pg.PoolClient) => Promise<T>) {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const result = await work(db); await db.query('COMMIT'); return result; }
    catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
  async function append(db: pg.PoolClient, p: Context, amount: number) {
    const existing = (await db.query('SELECT ordinal,name FROM points WHERE company_id=$1 AND desk_id=$2 ORDER BY ordinal', [p.companyId, p.deskId])).rows;
    let ordinal = existing.at(-1)?.ordinal ?? 0;
    if (ordinal + amount > deskLimits.ordinal) throw new HttpError(409, 'Limite da sequência de pontos atingido.');
    const names = new Set(existing.map(row => row.name));
    const ordinals: number[] = [], labels: string[] = [];
    for (let i = 0; i < amount; i++) {
      ordinal++; let label = `Ponto ${ordinal}`, suffix = ordinal;
      while (names.has(label)) label = `Ponto ${++suffix}`;
      names.add(label); ordinals.push(ordinal); labels.push(label);
    }
    await db.query(`INSERT INTO points(company_id,desk_id,ordinal,name)
      SELECT $1,$2,v.ordinal,v.name FROM unnest($3::integer[],$4::text[]) v(ordinal,name)`, [p.companyId, p.deskId, ordinals, labels]);
  }
  app.get<{ Params: Context }>(path, { config, schema: { params: params() } }, async request => {
    await parent(pool, request.params);
    return { desks: (await pool.query(`SELECT ${fields},(SELECT count(*)::int FROM points p WHERE p.company_id=d.company_id AND p.desk_id=d.id) AS "pointCount"
      FROM desks d WHERE d.company_id=$1 AND d.plan_id=$2 ORDER BY d.name,d.id`, [request.params.companyId, request.params.planId])).rows };
  });
  app.get<{ Params: Context }>(detail, { config, schema: { params: params(['deskId']) } }, async request => {
    // Mesa e pontos lidos no mesmo snapshot; não expõe destino nem implementa associação da etapa 08.
    return transaction(async db => {
      await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const row = await desk(db, request.params);
      const points = (await db.query(pointsQuery, [request.params.companyId, request.params.deskId])).rows;
      return { ...row, pointCount: points.length, points };
    });
  });
  app.post<{ Params: Context; Body: DeskCreateInput }>(path, { config, schema: { params: params(), body: {
    type: 'object', required: ['name', 'pointCount'], additionalProperties: false, properties: { name, pointCount: count, placement } } } }, async (request, reply) => {
    const row = await transaction(async db => {
      await parent(db, request.params);
      const result = await db.query(`INSERT INTO desks(company_id,plan_id,name,placement) VALUES ($1,$2,$3,coalesce($4::jsonb,'{"x":0,"y":0,"width":1.2,"height":0.6,"rotation":0}'))
        RETURNING id`, [request.params.companyId, request.params.planId, request.body.name, request.body.placement ? JSON.stringify(request.body.placement) : null]);
      const p = { ...request.params, deskId: result.rows[0].id };
      await append(db, p, request.body.pointCount);
      return { ...await desk(db, p), pointCount: request.body.pointCount, points: (await db.query(pointsQuery, [p.companyId, p.deskId])).rows };
    });
    return reply.code(201).send(row);
  });
  app.patch<{ Params: Context; Body: DeskUpdateInput }>(detail, { config, bodyLimit: 32768, schema: { params: params(['deskId']), body: {
    type: 'object', minProperties: 1, additionalProperties: false, dependencies: { pointCount: ['expectedPointIds'], expectedPointIds: ['pointCount'] },
    properties: { name, placement, pointCount: count, expectedPointIds: { type: 'array', maxItems: deskLimits.points, uniqueItems: true, items: uuid } } } } }, async request => {
    return transaction(async db => {
      const p = request.params, input = request.body;
      await desk(db, p, true); // Serializa todas as alterações de pontos nesta mesa.
      if (input.pointCount !== undefined || input.expectedPointIds !== undefined) {
        if (input.pointCount === undefined || !input.expectedPointIds) throw new HttpError(400, 'Informe a quantidade e os IDs atuais dos pontos.');
        const points = (await db.query('SELECT id FROM points WHERE company_id=$1 AND desk_id=$2 ORDER BY ordinal,id FOR UPDATE', [p.companyId, p.deskId])).rows;
        if (points.length !== input.expectedPointIds.length || points.some((row, i) => row.id !== input.expectedPointIds![i]))
          throw new HttpError(409, 'Os pontos desta mesa foram alterados. Atualize a lista antes de mudar a quantidade.');
        if (input.pointCount < points.length) {
          const removed = points.slice(input.pointCount).map(row => row.id);
          if ((await db.query('SELECT id FROM connections WHERE company_id=$1 AND point_id=ANY($2::uuid[])', [p.companyId, removed])).rowCount)
            throw new HttpError(409, 'Não é possível reduzir: um dos últimos pontos possui conexão. Desvincule-o explicitamente primeiro.');
          await db.query('DELETE FROM points WHERE company_id=$1 AND desk_id=$2 AND id=ANY($3::uuid[])', [p.companyId, p.deskId, removed]);
        } else await append(db, p, input.pointCount - points.length);
      }
      await db.query('UPDATE desks SET name=coalesce($3,name),placement=coalesce($4::jsonb,placement) WHERE company_id=$1 AND id=$2', [p.companyId, p.deskId, input.name ?? null, input.placement ? JSON.stringify(input.placement) : null]);
      const points = (await db.query(pointsQuery, [p.companyId, p.deskId])).rows;
      return { ...await desk(db, p), pointCount: points.length, points };
    });
  });
  app.patch<{ Params: Context; Body: { name: string } }>(point, { config, schema: { params: params(['deskId', 'pointId']), body: {
    type: 'object', required: ['name'], additionalProperties: false, properties: { name } } } }, async request => transaction(async db => {
    const p = request.params; await desk(db, p, true);
    const result = await db.query('UPDATE points SET name=$4 WHERE company_id=$1 AND desk_id=$2 AND id=$3 RETURNING id', [p.companyId, p.deskId, p.pointId, request.body.name]);
    if (!result.rowCount) throw new HttpError(404, 'Ponto não encontrado nesta mesa.');
    return (await db.query(pointsQuery, [p.companyId, p.deskId])).rows.find(row => row.id === p.pointId);
  }));
  app.delete<{ Params: Context }>(point, { config, schema: { params: params(['deskId', 'pointId']) } }, async (request, reply) => {
    await transaction(async db => {
      const p = request.params; await desk(db, p, true);
      try {
        const result = await db.query('DELETE FROM points WHERE company_id=$1 AND desk_id=$2 AND id=$3', [p.companyId, p.deskId, p.pointId]);
        if (!result.rowCount) throw new HttpError(404, 'Ponto não encontrado nesta mesa.');
      } catch (error) {
        if (['23503', '23001'].includes((error as { code?: string }).code ?? '')) throw new HttpError(409, 'Não é possível excluir: este ponto possui conexão. Desvincule-o explicitamente primeiro.');
        throw error;
      }
    }); return reply.code(204).send();
  });
  app.delete<{ Params: Context }>(detail, { config, schema: { params: params(['deskId']) } }, async (request, reply) => {
    await transaction(async db => {
      const p = request.params; await desk(db, p, true);
      if ((await db.query('SELECT id FROM points WHERE company_id=$1 AND desk_id=$2 LIMIT 1', [p.companyId, p.deskId])).rowCount)
        throw new HttpError(409, 'Não é possível excluir: esta mesa possui pontos. Remova os pontos sem conexão primeiro.');
      await db.query('DELETE FROM desks WHERE company_id=$1 AND id=$2', [p.companyId, p.deskId]);
    }); return reply.code(204).send();
  });
}
