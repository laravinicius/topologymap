import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { ConnectionDetail, ConnectionInput, ConnectionTransferInput, ConnectionDeleteInput, ExpectedConnection } from '@topologia-new/domain';
import { uuid } from '../admin/routes.js';
import { HttpError } from '../auth/authorization.js';
import { connectionJson } from './query.js';

type Context = { companyId: string; connectionId: string; pointId: string; portId: string };
const config = { access: 'company' as const };
const params = (key?: string) => ({ type: 'object', required: ['companyId', ...(key ? [key] : [])], additionalProperties: false,
  properties: { companyId: uuid, ...(key ? { [key]: uuid } : {}) } });
const endpoints = { pointId: uuid, portId: uuid };
const expected = { type: 'object', required: ['revision', 'pointId', 'portId'], additionalProperties: false,
  properties: { ...endpoints, revision: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER } } };
const stale = () => new HttpError(409, 'A conexão foi alterada ou removida. Atualize as duas extremidades antes de tentar novamente.');

export function registerConnections(app: FastifyInstance, pool: pg.Pool) {
  const base = '/api/companies/:companyId', path = `${base}/connections`, detail = `${path}/:connectionId`;
  app.get<{ Params: { companyId: string } }>(`${base}/points`, { config, schema: { params: params() } }, async request => {
    const result = await pool.query(`SELECT p.id,p.name,p.company_id AS "companyId",p.desk_id AS "deskId",d.name AS "deskName",pl.name AS "planName",p.ordinal,
      p.created_at AS "createdAt",p.updated_at AS "updatedAt",c.id AS "connectionId",
      ${connectionJson('c.company_id=p.company_id AND c.point_id=p.id')} AS connection
      FROM points p JOIN desks d ON d.company_id=p.company_id AND d.id=p.desk_id
      JOIN plans pl ON pl.company_id=d.company_id AND pl.id=d.plan_id
      LEFT JOIN connections c ON c.company_id=p.company_id AND c.point_id=p.id
      WHERE p.company_id=$1 ORDER BY p.name,p.id`, [request.params.companyId]);
    return { points: result.rows };
  });
  async function transaction<T>(work: (db: pg.PoolClient) => Promise<T>) {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const result = await work(db); await db.query('COMMIT'); return result; }
    catch (error) {
      await db.query('ROLLBACK');
      const code = (error as { code?: string }).code;
      if (code === '23505') throw new HttpError(409, 'Ponto ou porta já possui conexão. Consulte o vínculo atual e use a transferência explícita para alterá-lo.');
      if (['23503', '23001', '40001', '40P01'].includes(code ?? ''))
        throw new HttpError(409, 'As extremidades foram alteradas durante a operação. Atualize os cadastros e tente novamente.');
      throw error;
    } finally { db.release(); }
  }
  async function validateEndpoints(db: pg.PoolClient, companyId: string, input: ConnectionInput) {
    const result = await db.query(`SELECT
      EXISTS(SELECT 1 FROM points WHERE company_id=$1 AND id=$2) AS point,
      EXISTS(SELECT 1 FROM ports p JOIN equipment e ON e.company_id=p.company_id AND e.id=p.equipment_id
        WHERE p.company_id=$1 AND p.id=$3 AND e.kind='patch_panel') AS port`, [companyId, input.pointId, input.portId]);
    if (!result.rows[0].point || !result.rows[0].port) throw new HttpError(404, 'Ponto ou porta não encontrado nesta empresa.');
  }
  async function read(db: pg.Pool | pg.PoolClient, companyId: string, id: string): Promise<ConnectionDetail> {
    const connection = (await db.query(`SELECT ${connectionJson('c.company_id=$1 AND c.id=$2')} AS connection`, [companyId, id])).rows[0].connection;
    if (!connection) throw new HttpError(404, 'Conexão não encontrada nesta empresa.');
    return connection;
  }
  const state = (p: Context, e: ExpectedConnection) => [p.companyId, p.connectionId, e.revision, e.pointId, e.portId];
  const match = 'company_id=$1 AND id=$2 AND revision=$3 AND point_id=$4 AND port_id=$5';

  app.get<{ Params: Context }>(detail, { config, schema: { params: params('connectionId') } }, request => read(pool, request.params.companyId, request.params.connectionId));
  // Existência da extremidade e caminho lidos em um único statement/snapshot, inclusive quando livre.
  for (const side of ['point', 'port'] as const) {
    const key = `${side}Id` as const, table = side === 'point' ? 'points' : 'ports';
    app.get<{ Params: Context }>(`${base}/${table}/:${key}/connection`, { config, schema: { params: params(key) } }, async request => {
      const result = await pool.query(`SELECT p.id AS "${key}",${connectionJson(`c.company_id=p.company_id AND c.${side}_id=p.id`)} AS connection
        FROM ${table} p WHERE p.company_id=$1 AND p.id=$2`, [request.params.companyId, request.params[key]]);
      if (!result.rowCount) throw new HttpError(404, 'Extremidade não encontrada nesta empresa.');
      return result.rows[0];
    });
  }
  app.post<{ Params: Context; Body: ConnectionInput }>(path, { config, schema: { params: params(), body: {
    type: 'object', required: ['pointId', 'portId'], additionalProperties: false, properties: endpoints } } }, async (request, reply) => {
    const connection = await transaction(async db => {
      await validateEndpoints(db, request.params.companyId, request.body);
      // INSERT simples: unicidades independentes arbitram colisões, sem upsert/substituição.
      const inserted = await db.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id',
        [request.params.companyId, request.body.pointId, request.body.portId]);
      return read(db, request.params.companyId, inserted.rows[0].id);
    });
    return reply.code(201).send(connection);
  });
  app.post<{ Params: Context; Body: ConnectionTransferInput }>(`${detail}/transfer`, { config, schema: { params: params('connectionId'), body: {
    type: 'object', required: ['pointId', 'portId', 'expected'], additionalProperties: false, properties: { ...endpoints, expected } } } }, async request => transaction(async db => {
    const p = request.params, input = request.body;
    await validateEndpoints(db, p.companyId, input);
    if (input.pointId === input.expected.pointId && input.portId === input.expected.portId)
      throw new HttpError(400, 'Informe ao menos uma extremidade diferente para transferir.');
    // Compare-and-swap no UPDATE: reavaliado pelo PostgreSQL após esperar uma escrita concorrente.
    const changed = await db.query(`UPDATE connections SET point_id=$6,port_id=$7 WHERE ${match} RETURNING id`,
      [...state(p, input.expected), input.pointId, input.portId]);
    if (!changed.rowCount) throw stale();
    return read(db, p.companyId, p.connectionId);
  }));
  app.delete<{ Params: Context; Body: ConnectionDeleteInput }>(detail, { config, schema: { params: params('connectionId'), body: {
    type: 'object', required: ['expected'], additionalProperties: false, properties: { expected } } } }, async request => transaction(async db => {
    const removed = await db.query(`DELETE FROM connections WHERE ${match} RETURNING point_id AS "pointId",port_id AS "portId"`, state(request.params, request.body.expected));
    if (!removed.rowCount) throw stale();
    return { ...removed.rows[0], connection: null };
  }));
}
