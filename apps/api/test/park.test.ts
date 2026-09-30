import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';

test('etapa 05: cadastros, filiação, acesso e dependências em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test05_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 6 });
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false;
  let admin = '', user = '', userId = '', a = '', b = '', c = '', matrix = '', branch = '', fa = '', fb = '', pa = '', pb = '', dc1 = '', dc2 = '';
  try {
    assert.notEqual(database, config.database);
    await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool);
    await provisionAdmin(pool, { login: 'admin.synthetic', name: 'Admin QA', password });
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800 });
    const call = (method: InjectOptions['method'], url: string, cookie = admin, payload?: object) => app!.inject({ method, url, headers: { origin, ...(cookie ? { cookie } : {}) }, ...(payload ? { payload } : {}) });
    async function enter(login: string) {
      const result = await call('POST', '/api/auth/login', '', { login, password }); assert.equal(result.statusCode, 200);
      return result.headers['set-cookie']!.toString().split(';')[0]!;
    }
    const base = (id: string) => `/api/companies/${id}`;
    const units = () => `${base(a)}/units`;
    const floors = (unit = matrix) => `${units()}/${unit}/floors`;
    const plans = (unit = matrix, floor = fa) => `${floors(unit)}/${floor}/plans`;
    const dcs = (unit = matrix) => `${units()}/${unit}/datacenters`;
    async function create(url: string, payload: object, cookie = user) {
      const result = await call('POST', url, cookie, payload); assert.equal(result.statusCode, 201, result.body); return result.json().id as string;
    }
    admin = await enter('admin.synthetic');
    await t.test('gerente em A, visualizador em B; matriz/filial/CD/classificação livre e dois datacenters', async () => {
      a = await create('/api/admin/companies', { name: 'Empresa QA A' }, admin);
      b = await create('/api/admin/companies', { name: 'Empresa QA B' }, admin);
      c = await create('/api/admin/companies', { name: 'Empresa QA C' }, admin);
      userId = await create('/api/admin/users', { name: 'Gestor QA', login: 'manager.synthetic', password }, admin);
      for (const [company, role] of [[a, 'manager'], [b, 'viewer']]) assert.equal((await call('PUT', `/api/admin/users/${userId}/permissions/${company}`, admin, { role })).statusCode, 200);
      user = await enter('manager.synthetic');
      assert.deepEqual((await call('GET', `${base(a)}/park`, user)).json().units, []);
      matrix = await create(units(), { name: 'Matriz', classification: 'Matriz' });
      branch = await create(units(), { name: 'Filial', classification: 'Filial' });
      await create(units(), { name: 'Distribuição', classification: 'CD' });
      await create(units(), { name: 'Operação livre', classification: 'Identificação livre' });
      fa = await create(floors(), { name: 'Térreo' }); fb = await create(floors(branch), { name: 'Térreo' });
      pa = await create(plans(), { name: 'Planta 01' }); pb = await create(plans(branch, fb), { name: 'Planta 01' });
      dc1 = await create(dcs(), { name: 'Datacenter 01' }); dc2 = await create(dcs(), { name: 'Datacenter 02' });
      const snapshot = (await call('GET', `${base(a)}/park`, user)).json();
      assert.equal(snapshot.company.role, 'manager'); assert.equal(snapshot.units.length, 4); assert.equal(snapshot.datacenters.length, 2);
      assert.ok(snapshot.datacenters.every((dc: { unitId: string }) => dc.unitId === matrix));
      assert.deepEqual((await pool.query('SELECT geometry FROM plans WHERE id=$1', [pa])).rows[0].geometry, { version: 1, unit: 'm', walls: [], openings: [] });
      assert.equal((await call('GET', `${dcs(branch)}`, user)).json().datacenters.length, 0);
    });
    await t.test('CRUD de todos os recursos: grafia livre e renomeação preserva IDs, pais e vínculos', async () => {
      for (const [path, id, table] of [[units(), matrix, 'units'], [floors(), fa, 'floors'], [plans(), pa, 'plans'], [dcs(), dc1, 'datacenters']] as const) {
        const before = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
        const renamed = await call('PATCH', `${path}/${id}`, user, { name: 'Nome 01 Freso — livre' });
        assert.equal(renamed.statusCode, 200); assert.equal(renamed.json().id, id);
        const after = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
        for (const key of Object.keys(before).filter(key => !['name', 'updated_at'].includes(key))) assert.deepEqual(after[key], before[key], `${table}.${key}`);
        assert.equal((await call('GET', `${path}/${id}`, user)).json().name, 'Nome 01 Freso — livre');
        assert.equal((await call('GET', path, user)).statusCode, 200);
      }
      const company = await call('PATCH', `/api/admin/companies/${a}`, admin, { name: 'Empresa renomeada' });
      assert.equal(company.json().id, a); assert.equal((await call('GET', `${base(a)}/park`, user)).json().company.role, 'manager');
      assert.equal((await call('PATCH', `${units()}/${branch}`, user, { classification: 'CD' })).json().classification, 'CD');
    });
    await t.test('validação: nome/classificação, duplicidades, UUID, geometria e pais não alteráveis', async () => {
      for (const payload of [{ name: '', classification: 'Matriz' }, { name: '  ', classification: 'Matriz' }, { name: 'n'.repeat(201), classification: 'Matriz' }, { name: 'X' }, { name: 'X', classification: '' }, { name: 'X', classification: 'CD', companyId: b }])
        assert.equal((await call('POST', units(), user, payload)).statusCode, 400);
      for (const [path, id] of [[units(), matrix], [floors(), fa], [plans(), pa], [dcs(), dc1]] as const) {
        assert.equal((await call('POST', path, user, { name: 'Nome 01 Freso — livre', ...(path === units() ? { classification: 'Matriz' } : {}) })).statusCode, 409);
        assert.equal((await call('PATCH', `${path}/${id}`, user, {})).statusCode, 400);
        for (const payload of [{ name: ' ' }, { unitId: branch }, { id: randomUUID() }, { geometry: {} }, { name: 1 }])
          assert.equal((await call('PATCH', `${path}/${id}`, user, payload)).statusCode, 400);
        assert.equal((await call('GET', `${path}/not-a-uuid`, user)).statusCode, 400);
        assert.equal((await call('PATCH', `${path}/${randomUUID()}`, user, { name: 'X' })).statusCode, 404);
      }
    });
    await t.test('cada rota valida toda a cadeia; filhos de outra unidade/empresa jamais liberam acesso', async () => {
      const foreignUnit = await create(`${base(b)}/units`, { name: 'Matriz B', classification: 'Matriz' }, admin);
      const foreignFloor = await create(`${base(b)}/units/${foreignUnit}/floors`, { name: 'Andar B' }, admin);
      const foreignPlan = await create(`${base(b)}/units/${foreignUnit}/floors/${foreignFloor}/plans`, { name: 'Planta B' }, admin);
      const paths = [`${units()}/${foreignUnit}`, `${floors(branch)}/${fa}`, `${plans(branch, fb)}/${pa}`, `${dcs(branch)}/${dc1}`, `${plans(matrix, fa)}/${foreignPlan}`];
      for (const path of paths) for (const method of ['GET', 'PATCH', 'DELETE'] as const)
        assert.equal((await call(method, path, user, method === 'PATCH' ? { name: 'Ataque' } : undefined)).statusCode, 404);
      for (const path of [floors(foreignUnit), plans(branch, fa), `${base(a)}/units/${foreignUnit}/datacenters`]) {
        assert.equal((await call('GET', path, user)).statusCode, 404);
        assert.equal((await call('POST', path, user, { name: 'Ataque' })).statusCode, 404);
      }
      for (const path of [`${base(c)}/park`, `${base(c)}/units`, `${base(randomUUID())}/units`]) assert.equal((await call('GET', path, user)).statusCode, 404);
      // Também protege filiações persistidas, mesmo em comandos fora da API.
      for (const [sql, values] of [
        ['INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,$3)', [a, foreignUnit, 'Cruzado']],
        ['INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4)', [a, matrix, fb, 'Cruzado']],
        ['UPDATE datacenters SET plan_id=$2 WHERE id=$1', [dc1, pb]],
        ['UPDATE datacenters SET plan_id=$2 WHERE id=$1', [dc1, foreignPlan]],
      ] as const) await assert.rejects(pool.query(sql, [...values]), (e: unknown) => (e as { code: string }).code === '23503');
    });
    await t.test('visualizador não escreve nenhum recurso; gerente não cria/exclui empresas nem acessos', async () => {
      const bv = (await call('GET', `${base(b)}/park`, user)).json();
      const bu = bv.units[0].id, bf = bv.floors[0].id, bp = bv.plans[0].id;
      const bd = await create(`${base(b)}/units/${bu}/datacenters`, { name: 'DC B' }, admin);
      for (const [path, id, input] of [
        [`${base(b)}/units`, bu, { name: 'Negado', classification: 'Matriz' }],
        [`${base(b)}/units/${bu}/floors`, bf, { name: 'Negado' }],
        [`${base(b)}/units/${bu}/floors/${bf}/plans`, bp, { name: 'Negado' }],
        [`${base(b)}/units/${bu}/datacenters`, bd, { name: 'Negado' }],
      ] as const) {
        assert.equal((await call('GET', path, user)).statusCode, 200);
        assert.equal((await call('POST', path, user, input)).statusCode, 403);
        assert.equal((await call('PATCH', `${path}/${id}`, user, { name: 'Negado' })).statusCode, 403);
        assert.equal((await call('DELETE', `${path}/${id}`, user)).statusCode, 403);
      }
      assert.equal((await call('POST', '/api/admin/companies', user, { name: 'Negado' })).statusCode, 403);
      assert.equal((await call('PATCH', `/api/admin/companies/${a}`, user, { name: 'Negado' })).statusCode, 403);
      assert.equal((await call('DELETE', `/api/admin/companies/${a}`, user)).statusCode, 403);
      assert.equal((await call('PUT', `/api/admin/users/${userId}/permissions/${c}`, user, { role: 'manager' })).statusCode, 403);
    });
    await t.test('RESTRICT: unidades/andares/plantas/datacenters/empresas não perdem dependentes', async () => {
      await assert.rejects(pool.query('DELETE FROM units WHERE id=$1', [matrix]), (e: unknown) => ['23503', '23001'].includes((e as { code: string }).code));
      for (const path of [`${units()}/${matrix}`, `${floors()}/${fa}`, `/api/admin/companies/${a}`, `/api/admin/companies/${b}`]) {
        const result = await call('DELETE', path, admin);
        assert.equal(result.statusCode, 409, `${path}: ${result.body}`);
      }
      const permissionOnly = await create('/api/admin/companies', { name: 'Somente acesso' }, admin);
      await call('PUT', `/api/admin/users/${userId}/permissions/${permissionOnly}`, admin, { role: 'viewer' });
      assert.equal((await call('DELETE', `/api/admin/companies/${permissionOnly}`)).statusCode, 409);
      await call('DELETE', `/api/admin/users/${userId}/permissions/${permissionOnly}`);
      assert.equal((await call('DELETE', `/api/admin/companies/${permissionOnly}`)).statusCode, 204);
      assert.equal((await call('DELETE', `/api/admin/companies/${permissionOnly}`)).statusCode, 404);
      const rack = (await pool.query('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,42) RETURNING id', [a, matrix, dc1, 'Rack sintético'])).rows[0].id;
      assert.equal((await call('DELETE', `${dcs()}/${dc1}`, user)).statusCode, 409);
      await pool.query('DELETE FROM racks WHERE id=$1', [rack]);
      await pool.query('UPDATE datacenters SET plan_id=$2 WHERE id=$1', [dc1, pa]);
      assert.equal((await call('DELETE', `${plans()}/${pa}`, user)).statusCode, 409);
      await pool.query('UPDATE datacenters SET plan_id=NULL WHERE id=$1', [dc1]);
      const desk = (await pool.query('INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,$3) RETURNING id', [a, pa, 'Mesa sintética'])).rows[0].id;
      assert.equal((await call('DELETE', `${plans()}/${pa}`, user)).statusCode, 409);
      await pool.query('DELETE FROM desks WHERE id=$1', [desk]);
      const sector = (await pool.query('INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,$3,$4) RETURNING id', [a, pa, 'Setor sintético', JSON.stringify([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }])])).rows[0].id;
      assert.equal((await call('DELETE', `${plans()}/${pa}`, user)).statusCode, 409);
      await pool.query('DELETE FROM sectors WHERE id=$1', [sector]);
      assert.equal((await call('DELETE', `${plans()}/${pa}`, user)).statusCode, 204);
      assert.equal((await call('DELETE', `${floors()}/${fa}`, user)).statusCode, 204);
      assert.equal((await call('DELETE', `${dcs()}/${dc1}`, user)).statusCode, 204);
      assert.equal((await call('DELETE', `${units()}/${matrix}`, user)).statusCode, 409); // segundo datacenter
      assert.equal((await call('DELETE', `${dcs()}/${dc2}`, user)).statusCode, 204);
      assert.equal((await call('DELETE', `${units()}/${matrix}`, user)).statusCode, 204);
      assert.equal((await call('GET', `${units()}/${matrix}`, user)).statusCode, 404);
      assert.ok((await call('GET', `${base(a)}/park`, user)).json().plans.some((p: { id: string }) => p.id === pb));
    });
    await t.test('concorrência: exclusão do pai versus criação de filho nunca deixa órfãos', async () => {
      for (let i = 0; i < 4; i++) {
        const u = await create(units(), { name: `Concorrente ${i}`, classification: 'CD' });
        const [remove, insert] = await Promise.all([call('DELETE', `${units()}/${u}`, user), call('POST', floors(u), user, { name: 'Filho' })]);
        assert.ok([204, 409].includes(remove.statusCode)); assert.ok([201, 404, 409].includes(insert.statusCode));
        assert.ok(!(remove.statusCode === 204 && insert.statusCode === 201));
      }
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM floors f LEFT JOIN units u ON u.id=f.unit_id WHERE u.id IS NULL')).rows[0].n, 0);
    });
    await t.test('revogar/trocar papel vale na sessão existente; origem e sessão obrigatórias', async () => {
      const url = `${floors(branch)}/${fb}`;
      await call('PUT', `/api/admin/users/${userId}/permissions/${a}`, admin, { role: 'viewer' });
      assert.equal((await call('PATCH', url, user, { name: 'Negado' })).statusCode, 403);
      await call('PUT', `/api/admin/users/${userId}/permissions/${a}`, admin, { role: 'manager' });
      assert.equal((await call('PATCH', url, user, { name: 'Permitido' })).statusCode, 200);
      assert.equal((await app!.inject({ method: 'POST', url: units(), headers: { cookie: user }, payload: { name: 'Negado', classification: 'CD' } })).statusCode, 403);
      assert.equal((await call('GET', `${base(a)}/park`, '')).statusCode, 401);
      await call('DELETE', `/api/admin/users/${userId}/permissions/${a}`, admin);
      assert.equal((await call('GET', `${base(a)}/park`, user)).statusCode, 404);
      assert.equal((await call('PATCH', url, user, { name: 'Negado' })).statusCode, 404);
      assert.equal((await call('GET', `${base(b)}/park`, user)).statusCode, 200);
      assert.equal((await call('GET', '/api/auth/session', user)).statusCode, 200);
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await root.end();
  }
});
