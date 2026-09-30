import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { buildApp } from '../src/app.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { uuid } from '../src/admin/routes.js';

test('etapa 04: administração e isolamento por empresa em PostgreSQL exclusivo', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test04_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 5 });
  const origin = 'http://localhost:5173', password = randomBytes(24).toString('hex');
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false;
  try {
    assert.notEqual(database, config.database);
    await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool);
    await provisionAdmin(pool, { login: 'admin.synthetic', name: 'Admin sintético', password });
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800 });
    // Apenas no app de teste: prova escrita real com a política central, sem antecipar CRUD da etapa 05.
    const params = { type: 'object', required: ['companyId', 'unitId'], properties: { companyId: uuid, unitId: uuid } };
    app.patch<{ Params: { companyId: string; unitId: string }; Body: { name: string } }>('/api/test/companies/:companyId/units/:unitId', {
      config: { access: 'company' }, schema: { params },
    }, async (request, reply) => {
      const result = await pool.query('UPDATE units SET name=$3 WHERE company_id=$1 AND id=$2 RETURNING id,name', [request.company!.id, request.params.unitId, request.body.name]);
      return result.rowCount ? result.rows[0] : reply.code(404).send({ message: 'Unidade não encontrada.' });
    });
    app.get('/api/test/unclassified', async () => ({ secret: true }));
    const inject = (options: InjectOptions) => app!.inject(options);
    const enter = async (login: string, pass = password) => {
      await pool.query('DELETE FROM login_limits');
      const response = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login, password: pass } });
      assert.equal(response.statusCode, 200, response.body);
      return (response.headers['set-cookie'] as string).split(';')[0]!;
    };
    const adminCookie = await enter('admin.synthetic');
    const call = (method: InjectOptions['method'], url: string, cookie = adminCookie, payload?: InjectOptions['payload']) => inject({ method, url, headers: { origin, cookie }, ...(payload === undefined ? {} : { payload }) });
    let userId = '', userCookie = '', a = '', b = '', c = '', unitA = '', unitB = '';
    const permission = (id: string, role: string) => call('PUT', `/api/admin/users/${userId}/permissions/${id}`, adminCookie, { role });
    const write = (companyId: string, unitId: string, name: string, cookie = userCookie) => call('PATCH', `/api/test/companies/${companyId}/units/${unitId}`, cookie, { name });

    await t.test('cadastros exclusivos: cria usuário sem privilégios e empresas; respostas sem hashes/sessões', async () => {
      const user = await call('POST', '/api/admin/users', adminCookie, { login: ' MIXED.SYNTHETIC ', name: 'Usuário de teste', password });
      assert.equal(user.statusCode, 201); userId = user.json().id;
      assert.equal(user.json().isAdmin, false); assert.equal(user.json().login, 'mixed.synthetic');
      assert.deepEqual(Object.keys(user.json()).sort(), ['createdAt', 'id', 'isActive', 'isAdmin', 'login', 'name', 'updatedAt']);
      for (const name of ['Empresa sintética A', 'Empresa sintética B', 'Empresa sintética C']) {
        const response = await call('POST', '/api/admin/companies', adminCookie, { name });
        assert.equal(response.statusCode, 201);
        if (!a) a = response.json().id; else if (!b) b = response.json().id; else c = response.json().id;
      }
      unitA = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Unidade A') RETURNING id", [a])).rows[0].id;
      unitB = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Unidade B') RETURNING id", [b])).rows[0].id;
      const users = await call('GET', '/api/admin/users');
      assert.equal(users.statusCode, 200); assert.doesNotMatch(users.body, /password|hash|token|session/i);
      userCookie = await enter('mixed.synthetic');
    });
    await t.test('validação: duplicidades, limites, UUIDs e tentativa de escalar a administrador', async () => {
      assert.equal((await call('POST', '/api/admin/users', adminCookie, { login: 'mixed.synthetic', name: 'Outro', password })).statusCode, 409);
      for (const payload of [{ login: 'space login', name: 'Outro', password }, { login: 'valid', name: '   ', password }, { login: 'valid', name: 'Outro', password: 'short' }, { login: 'valid', name: 'Outro', password, isAdmin: true }]) {
        assert.equal((await call('POST', '/api/admin/users', adminCookie, payload)).statusCode, 400);
      }
      assert.equal((await call('PATCH', `/api/admin/users/${userId}`, adminCookie, { isAdmin: true })).statusCode, 400);
      assert.equal((await call('PATCH', '/api/admin/users/not-uuid', adminCookie, { name: 'Other' })).statusCode, 400);
      assert.equal((await call('PATCH', `/api/admin/users/${randomUUID()}`, adminCookie, { name: 'Other' })).statusCode, 404);
      assert.equal((await call('POST', '/api/admin/companies', adminCookie, { name: 'Empresa sintética A' })).statusCode, 409);
      assert.equal((await call('POST', '/api/admin/companies', adminCookie, { name: ' ' })).statusCode, 400);
      assert.equal((await permission(a, 'admin')).statusCode, 400);
      assert.equal((await permission(randomUUID(), 'viewer')).statusCode, 409);
      assert.equal((await call('GET', '/api/test/unclassified')).statusCode, 403);
    });
    await t.test('sem permissões: sessão válida, lista vazia e empresa não revelada', async () => {
      assert.equal((await call('GET', '/api/auth/session', userCookie)).statusCode, 200);
      assert.deepEqual((await call('GET', '/api/companies', userCookie)).json(), { companies: [] });
      assert.equal((await call('GET', `/api/companies/${a}/park`, userCookie)).statusCode, 404);
    });
    await t.test('mesmo usuário: manager em A, viewer em B; administrador acessa todas sem concessão', async () => {
      assert.equal((await permission(a, 'manager')).statusCode, 200);
      assert.equal((await permission(b, 'viewer')).statusCode, 200);
      const list = (await call('GET', '/api/companies', userCookie)).json().companies;
      assert.deepEqual(list.map((x: { id: string; role: string }) => [x.id, x.role]), [[a, 'manager'], [b, 'viewer']]);
      assert.equal((await call('GET', `/api/companies/${a}/park`, userCookie)).json().company.role, 'manager');
      assert.equal((await call('GET', `/api/companies/${b}/park`, userCookie)).json().company.role, 'viewer');
      const adminList = (await call('GET', '/api/companies')).json().companies;
      assert.equal(adminList.length, 3); assert.ok(adminList.every((x: { role: string }) => x.role === 'admin'));
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM company_permissions')).rows[0].n, 2);
    });
    await t.test('escrita direta: gerente grava em A, visualizador não grava em B; dados preservados', async () => {
      assert.equal((await write(a, unitA, 'Nome A atualizado')).statusCode, 200);
      const before = (await pool.query('SELECT * FROM units WHERE id=$1', [unitB])).rows;
      assert.equal((await write(b, unitB, 'Tentativa negada')).statusCode, 403);
      assert.deepEqual((await pool.query('SELECT * FROM units WHERE id=$1', [unitB])).rows, before);
      assert.equal((await write(b, unitB, 'Admin escreve em B', adminCookie)).statusCode, 200);
    });
    await t.test('gerente e visualizador não administram usuários, empresas nem acessos globais', async () => {
      for (const [method, url, payload] of [
        ['GET', '/api/admin/users', undefined], ['POST', '/api/admin/users', { login: 'attack', name: 'Attack', password }],
        ['PATCH', `/api/admin/users/${userId}`, { isActive: false }], ['POST', '/api/admin/companies', { name: 'Attack' }],
        ['PATCH', `/api/admin/companies/${a}`, { name: 'Attack' }], ['GET', `/api/admin/users/${userId}/permissions`, undefined],
        ['PUT', `/api/admin/users/${userId}/permissions/${c}`, { role: 'manager' }], ['DELETE', `/api/admin/users/${userId}/permissions/${b}`, undefined],
      ] as const) assert.equal((await call(method, url, userCookie, payload)).statusCode, 403);
    });
    await t.test('referências não autorizadas: ID da empresa e filho de outra empresa não liberam acesso', async () => {
      const hidden = await call('GET', `/api/companies/${c}/park`, userCookie);
      const missing = await call('GET', `/api/companies/${randomUUID()}/park`, userCookie);
      assert.equal(hidden.statusCode, 404); assert.deepEqual(hidden.json(), missing.json());
      assert.equal((await write(c, unitA, 'Cross company')).statusCode, 404);
      assert.equal((await write(a, unitB, 'Cross child')).statusCode, 404);
      assert.equal((await call('GET', '/api/companies/not-uuid/park', userCookie)).statusCode, 400);
      assert.equal((await call('GET', `/api/companies/${c}`, userCookie)).statusCode, 404);
    });
    await t.test('editar preserva IDs; concessão repetida não duplica e troca de papel vale na mesma sessão', async () => {
      assert.equal((await call('PATCH', `/api/admin/companies/${a}`, adminCookie, { name: 'Empresa A renomeada' })).json().id, a);
      assert.equal((await call('PATCH', `/api/admin/users/${userId}`, adminCookie, { name: 'Usuário renomeado', login: 'mixed.renamed' })).json().id, userId);
      assert.equal((await call('GET', '/api/auth/session', userCookie)).json().user.login, 'mixed.renamed');
      await permission(a, 'viewer'); await permission(a, 'viewer');
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM company_permissions WHERE user_id=$1 AND company_id=$2', [userId, a])).rows[0].n, 1);
      assert.equal((await write(a, unitA, 'Stale manager')).statusCode, 403);
      await permission(a, 'manager');
      assert.equal((await write(a, unitA, 'Manager restored')).statusCode, 200);
    });
    await t.test('revogação com cookie existente: acesso removido imediatamente; sessão e outra empresa continuam', async () => {
      assert.equal((await call('DELETE', `/api/admin/users/${userId}/permissions/${a}`)).statusCode, 204);
      assert.equal((await call('DELETE', `/api/admin/users/${userId}/permissions/${a}`)).statusCode, 204);
      assert.equal((await call('GET', `/api/companies/${a}/park`, userCookie)).statusCode, 404);
      assert.equal((await write(a, unitA, 'Revoked')).statusCode, 404);
      assert.deepEqual((await call('GET', '/api/companies', userCookie)).json().companies.map((x: { id: string }) => x.id), [b]);
      assert.equal((await call('GET', `/api/companies/${b}/park`, userCookie)).statusCode, 200);
      assert.equal((await call('GET', '/api/auth/session', userCookie)).statusCode, 200);
    });
    await t.test('desativação por API revoga sessões; reativar não revive cookie antigo; concessão a inativo rejeitada', async () => {
      assert.equal((await call('PATCH', `/api/admin/users/${userId}`, adminCookie, { isActive: false })).statusCode, 200);
      for (const url of ['/api/auth/session', '/api/companies', `/api/companies/${b}/park`]) assert.equal((await call('GET', url, userCookie)).statusCode, 401);
      assert.equal((await permission(a, 'manager')).statusCode, 409);
      const login = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'mixed.renamed', password } });
      assert.equal(login.statusCode, 401);
      await call('PATCH', `/api/admin/users/${userId}`, adminCookie, { isActive: true });
      assert.equal((await call('GET', '/api/auth/session', userCookie)).statusCode, 401);
      userCookie = await enter('mixed.renamed');
      assert.equal((await call('GET', `/api/companies/${b}/park`, userCookie)).statusCode, 200);
    });
    await t.test('trocar senha revoga sessão; senha antiga falha e nova funciona; admin não é desativado', async () => {
      const next = randomBytes(24).toString('hex');
      assert.equal((await call('PATCH', `/api/admin/users/${userId}`, adminCookie, { password: next })).statusCode, 200);
      assert.equal((await call('GET', '/api/auth/session', userCookie)).statusCode, 401);
      assert.equal((await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'mixed.renamed', password } })).statusCode, 401);
      userCookie = await enter('mixed.renamed', next);
      const adminId = (await call('GET', '/api/auth/session')).json().user.id;
      assert.equal((await call('PATCH', `/api/admin/users/${adminId}`, adminCookie, { isActive: false })).statusCode, 409);
      assert.equal((await call('GET', '/api/auth/session')).statusCode, 200);
    });
    await t.test('CSRF e sessão continuam obrigatórios em cadastros e concessões', async () => {
      assert.equal((await inject({ method: 'POST', url: '/api/admin/companies', headers: { cookie: adminCookie }, payload: { name: 'No origin' } })).statusCode, 403);
      assert.equal((await inject({ method: 'POST', url: '/api/admin/companies', headers: { origin }, payload: { name: 'No session' } })).statusCode, 401);
      assert.equal((await inject({ method: 'PUT', url: `/api/admin/users/${userId}/permissions/${c}`, headers: { origin: 'https://other.invalid', cookie: adminCookie }, payload: { role: 'manager' } })).statusCode, 403);
      assert.equal((await inject({ method: 'GET', url: '/api/admin/users' })).statusCode, 401);
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await root.end();
  }
});
