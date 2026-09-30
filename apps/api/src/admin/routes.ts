import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { CompanyInput, CreateUserInput, UpdateUserInput, PermissionInput } from '@topologia-new/domain';
import { hashPassword, normalizeLogin, validLogin, validPassword } from '../auth/password.js';
import { companyFields, HttpError } from '../auth/authorization.js';

export const uuid = { type: 'string', format: 'uuid' };
const name = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const login = { type: 'string', minLength: 1, maxLength: 100 };
const password = { type: 'string', minLength: 12, maxLength: 128 };
const userFields = 'id,login,name,is_admin AS "isAdmin",is_active AS "isActive",created_at AS "createdAt",updated_at AS "updatedAt"';
const admin = { access: 'admin' as const };
const params = (properties: Record<string, unknown>) => ({ type: 'object', required: Object.keys(properties), additionalProperties: false, properties });
const userParams = params({ userId: uuid });
const companyParams = params({ companyId: uuid });
const permissionParams = params({ userId: uuid, companyId: uuid });
const companyBody = { type: 'object', required: ['name'], additionalProperties: false, properties: { name } };
function validateUser(input: UpdateUserInput) {
  if (input.login !== undefined && !validLogin(normalizeLogin(input.login))) throw new HttpError(400, 'Login inválido: use letras sem acentos, números e . _ @ + -');
  if (input.password !== undefined && !validPassword(input.password)) throw new HttpError(400, 'Senha deve ter de 12 a 128 caracteres.');
}

export function registerAdministration(app: FastifyInstance, pool: pg.Pool) {
  app.get('/api/admin/users', { config: admin }, async () => ({ users: (await pool.query(`SELECT ${userFields} FROM users ORDER BY name,id`)).rows }));
  app.post<{ Body: CreateUserInput }>('/api/admin/users', {
    config: admin, schema: { body: { type: 'object', required: ['name', 'login', 'password'], additionalProperties: false, properties: { name, login, password } } },
  }, async (request, reply) => {
    validateUser(request.body);
    const hash = await hashPassword(request.body.password);
    const result = await pool.query(`INSERT INTO users(name,login,password_hash) VALUES ($1,$2,$3) RETURNING ${userFields}`,
      [request.body.name, normalizeLogin(request.body.login), hash]);
    return reply.code(201).send(result.rows[0]);
  });
  app.patch<{ Params: { userId: string }; Body: UpdateUserInput }>('/api/admin/users/:userId', {
    config: admin, schema: { params: userParams, body: { type: 'object', minProperties: 1, additionalProperties: false, properties: { name, login, password, isActive: { type: 'boolean' } } } },
  }, async request => {
    validateUser(request.body);
    const input = request.body;
    const hash = input.password === undefined ? null : await hashPassword(input.password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT is_admin FROM users WHERE id=$1 FOR UPDATE', [request.params.userId]);
      if (!current.rowCount) throw new HttpError(404, 'Usuário não encontrado.');
      if (current.rows[0].is_admin && input.isActive === false) throw new HttpError(409, 'O administrador geral não pode ser desativado.');
      const result = await client.query(`UPDATE users SET name=coalesce($2,name),login=coalesce($3,login),
        password_hash=coalesce($4,password_hash),is_active=coalesce($5,is_active) WHERE id=$1 RETURNING ${userFields}`,
      [request.params.userId, input.name ?? null, input.login === undefined ? null : normalizeLogin(input.login), hash, input.isActive ?? null]);
      if (hash !== null || input.isActive === false) await client.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL', [request.params.userId]);
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
  app.get('/api/companies', { config: { access: 'session' } }, async request => ({
    companies: (await pool.query(`SELECT ${companyFields},CASE WHEN u.is_admin THEN 'admin' ELSE p.role END AS role
      FROM companies c JOIN users u ON u.id=$1 AND u.is_active
      LEFT JOIN company_permissions p ON p.company_id=c.id AND p.user_id=u.id
      WHERE u.is_admin OR p.role IS NOT NULL ORDER BY c.name,c.id`, [request.session!.user.id])).rows,
  }));
  app.get('/api/companies/:companyId', { config: { access: 'company' }, schema: { params: companyParams } }, async request => request.company);
  app.post<{ Body: CompanyInput }>('/api/admin/companies', { config: admin, schema: { body: companyBody } }, async (request, reply) => {
    const result = await pool.query('INSERT INTO companies(name) VALUES ($1) RETURNING id,name,created_at AS "createdAt",updated_at AS "updatedAt"', [request.body.name]);
    return reply.code(201).send(result.rows[0]);
  });
  app.patch<{ Params: { companyId: string }; Body: CompanyInput }>('/api/admin/companies/:companyId', { config: admin, schema: { params: companyParams, body: companyBody } }, async request => {
    const result = await pool.query('UPDATE companies SET name=$2 WHERE id=$1 RETURNING id,name,created_at AS "createdAt",updated_at AS "updatedAt"', [request.params.companyId, request.body.name]);
    if (!result.rowCount) throw new HttpError(404, 'Empresa não encontrada.');
    return result.rows[0];
  });
  app.delete<{ Params: { companyId: string } }>('/api/admin/companies/:companyId', { config: admin, schema: { params: companyParams } }, async (request, reply) => {
    try {
      const result = await pool.query('DELETE FROM companies WHERE id=$1', [request.params.companyId]);
      if (!result.rowCount) throw new HttpError(404, 'Empresa não encontrada.');
    } catch (error) {
      if (['23503', '23001'].includes((error as { code?: string }).code ?? '')) throw new HttpError(409, 'Não é possível excluir a empresa: remova os cadastros dependentes e revogue seus acessos primeiro.');
      throw error;
    }
    return reply.code(204).send();
  });
  app.get<{ Params: { userId: string } }>('/api/admin/users/:userId/permissions', { config: admin, schema: { params: userParams } }, async request => {
    if (!(await pool.query('SELECT id FROM users WHERE id=$1', [request.params.userId])).rowCount) throw new HttpError(404, 'Usuário não encontrado.');
    return { permissions: (await pool.query('SELECT company_id AS "companyId",role FROM company_permissions WHERE user_id=$1 ORDER BY company_id', [request.params.userId])).rows };
  });
  app.put<{ Params: { userId: string; companyId: string }; Body: PermissionInput }>('/api/admin/users/:userId/permissions/:companyId', {
    config: admin, schema: { params: permissionParams, body: { type: 'object', required: ['role'], additionalProperties: false, properties: { role: { type: 'string', enum: ['manager', 'viewer'] } } } },
  }, async (request, reply) => {
    const result = await pool.query(`INSERT INTO company_permissions(user_id,company_id,role)
      SELECT u.id,c.id,$3 FROM users u CROSS JOIN companies c WHERE u.id=$1 AND c.id=$2 AND u.is_active AND NOT u.is_admin
      ON CONFLICT(user_id,company_id) DO UPDATE SET role=excluded.role RETURNING company_id AS "companyId",role`,
    [request.params.userId, request.params.companyId, request.body.role]);
    if (!result.rowCount) throw new HttpError(409, 'Selecione um usuário ativo sem perfil de administrador e uma empresa existente.');
    return reply.send(result.rows[0]);
  });
  app.delete<{ Params: { userId: string; companyId: string } }>('/api/admin/users/:userId/permissions/:companyId', { config: admin, schema: { params: permissionParams } }, async (request, reply) => {
    await pool.query('DELETE FROM company_permissions WHERE user_id=$1 AND company_id=$2', [request.params.userId, request.params.companyId]);
    return reply.code(204).send();
  });
}
