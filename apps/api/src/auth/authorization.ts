import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { AccessibleCompany } from '@topologia-new/domain';
import { isPublicDeskRequest } from '../public-desks/routes.js';

export type AccessPolicy = 'session' | 'admin' | 'company';
declare module 'fastify' {
  interface FastifyContextConfig { access?: AccessPolicy }
  interface FastifyRequest { company: AccessibleCompany | null }
}
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export const companyFields = 'c.id,c.name,c.created_at AS "createdAt",c.updated_at AS "updatedAt"';

/** Consulta sempre o banco atual; papéis não são copiados para cookie/sessão. */
export async function companyAccess(pool: pg.Pool, request: FastifyRequest, companyId: string): Promise<AccessibleCompany> {
  const user = request.session!.user;
  const result = await pool.query(`SELECT ${companyFields},
    CASE WHEN u.is_admin THEN 'admin' ELSE p.role END AS role
    FROM companies c JOIN users u ON u.id=$2 AND u.is_active
    LEFT JOIN company_permissions p ON p.company_id=c.id AND p.user_id=u.id
    WHERE c.id=$1 AND (u.is_admin OR p.role IS NOT NULL)`, [companyId, user.id]);
  // A mesma resposta para ID inexistente e empresa não autorizada evita revelar clientes.
  if (!result.rowCount) throw new HttpError(404, 'Empresa não encontrada ou sem acesso.');
  const company = result.rows[0] as AccessibleCompany;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && company.role === 'viewer') {
    throw new HttpError(403, 'Seu acesso a esta empresa permite somente visualização.');
  }
  return company;
}

export function registerAuthorization(app: FastifyInstance, pool: pg.Pool) {
  app.decorateRequest('company', null);
  app.addHook('preHandler', async request => {
    const route = request.routeOptions.url;
    if (isPublicDeskRequest(request)) return;
    if ((route === '/api/health' && ['GET', 'HEAD'].includes(request.method)) ||
      (['/api/auth/login', '/api/auth/logout'].includes(route ?? '') && request.method === 'POST')) return;
    const policy = request.routeOptions.config.access;
    if (!request.session) throw new HttpError(401, 'Entre para acessar a aplicação.');
    // Rotas novas precisam declarar uma política; ausência nunca concede acesso.
    if (!policy) throw new HttpError(403, 'Operação não autorizada.');
    if (policy === 'admin' && !request.session.user.isAdmin) throw new HttpError(403, 'Operação exclusiva do administrador geral.');
    if (policy === 'company') {
      const { companyId } = request.params as { companyId: string };
      request.company = await companyAccess(pool, request, companyId);
    }
  });
}
