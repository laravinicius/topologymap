import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { publicOrigin, publicTokenPattern, type PublicLinkAction } from '@topologia-new/domain';
import { HttpError } from '../auth/authorization.js';
import { uuid } from '../admin/routes.js';

export const publicDeskRoute = '/api/public/desks/:token';
/** Exceção única e explícita compartilhada pelos dois hooks; nunca por prefixo. */
export const isPublicDeskRequest = (request: FastifyRequest) => request.routeOptions.url === publicDeskRoute && ['GET', 'HEAD'].includes(request.method);
type Context = { companyId: string; unitId: string; floorId: string; planId: string; deskId: string };
const keys = ['companyId', 'unitId', 'floorId', 'planId', 'deskId'];
const params = { type: 'object', required: keys, additionalProperties: false, properties: Object.fromEntries(keys.map(key => [key, uuid])) };
const unavailable = () => new HttpError(404, 'Mesa pública indisponível.');

export function registerPublicDesks(app: FastifyInstance, pool: pg.Pool, configuredOrigin: string) {
  const origin = publicOrigin(configuredOrigin);
  app.get<{ Params: { token: string } }>(publicDeskRoute, async (request, reply) => {
    reply.header('Referrer-Policy', 'no-referrer').header('X-Robots-Tag', 'noindex, nofollow');
    if (!publicTokenPattern.test(request.params.token)) throw unavailable();
    // Um único statement/snapshot. A conexão canônica é lida, nunca copiada para a etiqueta.
    const result = await pool.query(`SELECT d.name, coalesce((SELECT jsonb_agg(jsonb_build_object(
      'name', p.name, 'destination', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
        'datacenter', dc.name, 'rack', r.name, 'patchPanel', e.name, 'port', po.name) END) ORDER BY p.ordinal,p.id)
      FROM points p
      LEFT JOIN connections c ON c.company_id=p.company_id AND c.point_id=p.id
      LEFT JOIN ports po ON po.company_id=c.company_id AND po.id=c.port_id
      LEFT JOIN equipment e ON e.company_id=po.company_id AND e.id=po.equipment_id
      LEFT JOIN racks r ON r.company_id=e.company_id AND r.id=e.rack_id
      LEFT JOIN datacenters dc ON dc.company_id=r.company_id AND dc.id=r.datacenter_id
      WHERE p.company_id=d.company_id AND p.desk_id=d.id), '[]'::jsonb) AS points
      FROM desk_public_links l JOIN desks d ON d.company_id=l.company_id AND d.id=l.desk_id
      WHERE l.token=$1 AND l.enabled`, [request.params.token]);
    if (!result.rowCount) throw unavailable();
    return result.rows[0];
  });
  const path = '/api/companies/:companyId/units/:unitId/floors/:floorId/plans/:planId/desks/:deskId/public-link';
  const config = { access: 'company' as const };
  function manager(request: FastifyRequest) {
    if (request.company?.role === 'viewer') throw new HttpError(403, 'A gestão do endereço público exige gerente ou administrador.');
  }
  async function desk(db: pg.Pool | pg.PoolClient, p: Context, lock = false) {
    const result = await db.query(`SELECT d.id FROM desks d JOIN plans pl ON pl.company_id=d.company_id AND pl.id=d.plan_id
      WHERE d.company_id=$1 AND pl.unit_id=$2 AND pl.floor_id=$3 AND pl.id=$4 AND d.id=$5 ${lock ? 'FOR UPDATE OF d' : ''}`,
    [p.companyId, p.unitId, p.floorId, p.planId, p.deskId]);
    if (!result.rowCount) throw new HttpError(404, 'Mesa não encontrada nesta planta.');
  }
  async function link(db: pg.Pool | pg.PoolClient, p: Context) {
    const row = (await db.query('SELECT token,enabled,revision FROM desk_public_links WHERE company_id=$1 AND desk_id=$2', [p.companyId, p.deskId])).rows[0];
    return { token: row?.token ?? null, enabled: row?.enabled ?? false, revision: Number(row?.revision ?? 0), origin };
  }
  app.get<{ Params: Context }>(path, { config, schema: { params } }, async request => {
    manager(request); await desk(pool, request.params); return link(pool, request.params);
  });
  app.put<{ Params: Context; Body: { action: PublicLinkAction; expectedRevision: number } }>(path, { config, schema: { params, body: {
    type: 'object', required: ['action', 'expectedRevision'], additionalProperties: false,
    properties: { action: { type: 'string', enum: ['activate', 'deactivate', 'renew'] }, expectedRevision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 } },
  } } }, async request => {
    manager(request);
    const db = await pool.connect(), p = request.params;
    try {
      await db.query('BEGIN'); await desk(db, p, true);
      const current = await link(db, p), { action, expectedRevision } = request.body;
      if (current.revision !== expectedRevision) throw new HttpError(409, 'O endereço foi alterado em outra sessão. Atualize antes de continuar.');
      if (!current.token && action !== 'activate') throw new HttpError(409, 'Ative o endereço público primeiro.');
      const token = !current.token || action === 'renew' ? randomBytes(32).toString('hex') : current.token;
      const enabled = action === 'renew' ? current.enabled : action === 'activate';
      await db.query(`INSERT INTO desk_public_links(company_id,desk_id,token,enabled,revision) VALUES ($1,$2,$3,$4,1)
        ON CONFLICT (desk_id) DO UPDATE SET token=EXCLUDED.token,enabled=EXCLUDED.enabled,revision=desk_public_links.revision+1`, [p.companyId, p.deskId, token, enabled]);
      const result = await link(db, p); await db.query('COMMIT'); return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  });
}
