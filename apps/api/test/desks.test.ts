import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import type { DeskDetail } from '@topologia-new/domain';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';

test('etapa 06: mesas e pontos em PostgreSQL independente', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test06_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 8 });
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false;
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let admin = '', user = '', uid = '', a = '', b = '', c = '', path = '', other = '', foreign = '', fixturePort = '', d: DeskDetail;
  try {
    assert.notEqual(database, config.database); await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool); await provisionAdmin(pool, { login: 'admin.qa', name: 'Admin QA', password });
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800 });
    const call = (method: InjectOptions['method'], url: string, payload?: object, cookie = user) => app!.inject({ method, url, headers: { origin, cookie }, ...(payload ? { payload } : {}) });
    async function login(login: string) {
      const result = await call('POST', '/api/auth/login', { login, password }, ''); assert.equal(result.statusCode, 200, result.body);
      return result.headers['set-cookie']!.toString().split(';')[0]!;
    }
    async function create(url: string, payload: object, cookie = admin) {
      const result = await call('POST', url, payload, cookie); assert.equal(result.statusCode, 201, result.body); return result.json();
    }
    async function hierarchy(company: string) {
      const base = `/api/companies/${company}/units`;
      const u = await create(base, { name: 'Matriz QA', classification: 'Matriz' });
      const f = await create(`${base}/${u.id}/floors`, { name: 'Térreo QA' });
      const p = await create(`${base}/${u.id}/floors/${f.id}/plans`, { name: 'Planta QA' });
      return `${base}/${u.id}/floors/${f.id}/plans/${p.id}/desks`;
    }
    async function get() { const r = await call('GET', `${path}/${d.id}`); assert.equal(r.statusCode, 200); return r.json<DeskDetail>(); }
    async function resize(n: number, expected = d.points.map(p => p.id)) { return call('PATCH', `${path}/${d.id}`, { pointCount: n, expectedPointIds: expected }); }
    await t.test('dependências atuais, oito pontos sem racks e grafia exata por planta', async () => {
      admin = await login('admin.qa');
      a = (await create('/api/admin/companies', { name: 'A QA' })).id;
      b = (await create('/api/admin/companies', { name: 'B QA' })).id;
      c = (await create('/api/admin/companies', { name: 'C QA' })).id;
      uid = (await create('/api/admin/users', { name: 'Gestor QA', login: 'manager.qa', password })).id;
      assert.equal((await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'manager' }, admin)).statusCode, 200);
      assert.equal((await call('PUT', `/api/admin/users/${uid}/permissions/${b}`, { role: 'viewer' }, admin)).statusCode, 200);
      user = await login('manager.qa'); path = await hierarchy(a); foreign = await hierarchy(b); other = await hierarchy(c);
      const planBase = path.split('/').slice(0, -2).join('/');
      const p2 = await create(planBase, { name: 'Outra planta' });
      other = `${planBase}/${p2.id}/desks`;
      d = await create(path, { name: ' Mesa 01 Freso ', pointCount: 8 }, user);
      assert.equal(d.name, ' Mesa 01 Freso '); assert.equal(d.pointCount, 8);
      assert.deepEqual(d.points.map(p => p.name), Array.from({ length: 8 }, (_, i) => `Ponto ${i + 1}`));
      assert.ok(d.points.every(p => p.deskId === d.id && p.companyId === a && p.connectionId === null));
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM racks')).rows[0].n, 0);
      await create(other, { name: d.name, pointCount: 0 }, user);
      await create(path, { name: 'Mesa 1', pointCount: 0 }, user); await create(path, { name: 'Mesa 01', pointCount: 0 }, user);
      assert.equal((await call('POST', path, { name: d.name, pointCount: 1 })).statusCode, 409);
    });
    await t.test('entradas inválidas, UUIDs e campos imutáveis sem gravação parcial', async () => {
      const before = (await pool.query('SELECT count(*)::int AS n FROM desks')).rows[0].n;
      for (const body of [{ name: ' ', pointCount: 8 }, { name: 'x'.repeat(201), pointCount: 8 },
        ...[-1, 513, 1.5, '8', null].map(pointCount => ({ name: 'Inválida', pointCount })),
        { name: 'Sem quantidade' }, { name: 'Inválida', pointCount: 1, companyId: b },
        ...[{ x: 0, y: 0, width: 0, height: 1, rotation: 0 }, { x: 0, y: 0, width: 1, height: 1, rotation: 360 },
          { x: 1000001, y: 0, width: 1, height: 1, rotation: 0 }, { x: 0, y: 0, width: 1, height: -1, rotation: 0 }].map(placement => ({ name: 'Inválida', pointCount: 1, placement }))])
        assert.equal((await call('POST', path, body)).statusCode, 400, JSON.stringify(body));
      assert.equal((await call('GET', `${path}/invalido`)).statusCode, 400);
      assert.match((await call('POST', path, { name: 'Inválida', pointCount: 513 })).json().message, /inteiro entre 0 e 512/);
      assert.match((await call('POST', path, { name: ' ', pointCount: 8 })).json().message, /1 a 200 caracteres/);
      assert.equal((await call('PATCH', `${path}/${d.id}`, { pointCount: 7 })).statusCode, 400);
      assert.equal((await call('PATCH', `${path}/${d.id}`, { id: randomUUID() })).statusCode, 400);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM desks')).rows[0].n, before);
    });
    await t.test('falha durante criação dos pontos desfaz a mesa e todo o lote', async () => {
      await pool.query(`CREATE FUNCTION qa_fail_point() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.ordinal=4 AND EXISTS(SELECT 1 FROM desks WHERE id=NEW.desk_id AND name='Rollback QA') THEN
          RAISE EXCEPTION 'Falha sintética' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER qa_fail BEFORE INSERT ON points FOR EACH ROW EXECUTE FUNCTION qa_fail_point()`);
      assert.equal((await call('POST', path, { name: 'Rollback QA', pointCount: 8 })).statusCode, 503);
      assert.equal((await pool.query("SELECT id FROM desks WHERE name='Rollback QA'")).rowCount, 0);
      assert.equal((await pool.query('SELECT id FROM points WHERE desk_id NOT IN (SELECT id FROM desks)')).rowCount, 0);
      await pool.query('DROP TRIGGER qa_fail ON points; DROP FUNCTION qa_fail_point()');
    });
    await t.test('renomear/mover/girar e ampliar preserva IDs; números nos nomes não definem quantidade', async () => {
      const before = d;
      const r = await call('PATCH', `${path}/${d.id}/points/${d.points[0]!.id}`, { name: ' Ponto 999 Freso ' }); assert.equal(r.statusCode, 200);
      const placement = { x: -2.5, y: 8, width: 1.4, height: 0.7, rotation: 45 };
      assert.equal((await call('PATCH', `${path}/${d.id}`, { name: 'Mesa 01 revisada', placement })).statusCode, 200);
      d = await get(); assert.equal(d.pointCount, 8); assert.deepEqual(d.placement, placement);
      assert.equal(d.createdAt, before.createdAt); assert.equal(d.points[0]!.name, ' Ponto 999 Freso ');
      assert.equal((await resize(10)).statusCode, 200); d = await get();
      assert.deepEqual(d.points.slice(0, 8).map(p => p.id), before.points.map(p => p.id));
      assert.equal((await resize(11, before.points.map(p => p.id))).statusCode, 409);
      assert.equal((await call('PATCH', `${path}/${d.id}/points/${d.points[1]!.id}`, { name: d.points[0]!.name })).statusCode, 409);
      assert.equal((await call('DELETE', `${path}/${d.id}/points/${d.points[4]!.id}`)).statusCode, 204);
      d = await get(); assert.equal(d.pointCount, 9);
      // Próximo nome já ocupado por renomeação: gera um nome livre, sem substituir.
      await call('PATCH', `${path}/${d.id}/points/${d.points[1]!.id}`, { name: 'Ponto 11' });
      assert.equal((await resize(10)).statusCode, 200); d = await get(); assert.equal(d.points.at(-1)!.name, 'Ponto 12');
    });
    await t.test('conexões bloqueiam redução e exclusão, inclusive rollback de nome/posição', async () => {
      const company = a, unit = path.split('/')[5], plan = path.split('/')[9];
      const dc = (await pool.query('INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [company, unit, 'DC QA'])).rows[0].id;
      const rack = (await pool.query('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,10) RETURNING id', [company, unit, dc, 'Rack QA'])).rows[0].id;
      const eq = (await pool.query("INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u) VALUES ($1,$2,'PP QA','patch_panel','Patch panel',1,1,10) RETURNING id", [company, rack])).rows[0].id;
      const port = (await pool.query("INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Porta 1',1) RETURNING id", [company, eq])).rows[0].id;
      fixturePort = port;
      const tail = d.points.at(-1)!;
      const connection = (await pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [company, tail.id, port])).rows[0].id;
      const r = await call('PATCH', `${path}/${d.id}`, { name: 'Não salvar', pointCount: 8, expectedPointIds: d.points.map(p => p.id) }); assert.equal(r.statusCode, 409);
      assert.equal((await call('DELETE', `${path}/${d.id}/points/${tail.id}`)).statusCode, 409);
      assert.equal((await call('DELETE', `${path}/${d.id}`)).statusCode, 409);
      d = await get(); assert.equal(d.name, 'Mesa 01 revisada'); assert.equal(d.pointCount, 10); assert.equal(d.points.at(-1)!.connectionId, connection);
      assert.equal((await pool.query('SELECT id FROM connections WHERE id=$1', [connection])).rowCount, 1);
      assert.equal((await call('DELETE', path.slice(0, -6))).statusCode, 409); assert.ok(plan);
      await pool.query('DELETE FROM connections WHERE id=$1', [connection]);
      const ids = d.points.map(p => p.id); assert.equal((await resize(8)).statusCode, 200); d = await get(); assert.deepEqual(d.points.map(p => p.id), ids.slice(0, 8));
    });
    await t.test('corrida de exclusão do ponto contra nova conexão nunca produz órfão nem remove vínculo', async () => {
      for (let i = 0; i < 4; i++) {
        const row = await create(path, { name: `Concorrência conexão ${i}`, pointCount: 1 }, user);
        const pointId = row.points[0].id;
        const results = await Promise.allSettled([
          pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [a, pointId, fixturePort]),
          call('DELETE', `${path}/${row.id}/points/${pointId}`),
        ]);
        const connection = results[0]!, deletion = results[1]!;
        assert.equal(deletion.status, 'fulfilled');
        if (connection.status === 'fulfilled') {
          assert.equal(deletion.value.statusCode, 409);
          assert.equal((await pool.query('SELECT id FROM points WHERE id=$1', [pointId])).rowCount, 1);
          await pool.query('DELETE FROM connections WHERE id=$1', [connection.value.rows[0].id]);
        } else {
          assert.equal(deletion.value.statusCode, 204);
          assert.equal(connection.reason.code, '23503');
          assert.equal((await pool.query('SELECT id FROM connections WHERE point_id=$1', [pointId])).rowCount, 0);
        }
      }
    });
    await t.test('duas ampliações simultâneas: uma grava e outra recebe conflito', async () => {
      const responses = await Promise.all([resize(9), resize(10)]);
      assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 409]);
      const old = d.points.map(p => p.id); d = await get(); assert.deepEqual(d.points.slice(0, 8).map(p => p.id), old);
      assert.equal(new Set(d.points.map(p => p.ordinal)).size, d.pointCount);
    });
    await t.test('viewer, empresa sem acesso, cadeia cruzada, ponto de outra mesa e revogação', async () => {
      const remote = await create(foreign, { name: 'Mesa B', pointCount: 2 });
      assert.equal((await call('GET', `${foreign}/${remote.id}`)).statusCode, 200);
      for (const [method, url, body] of [['POST', foreign, { name: 'Negado', pointCount: 8 }], ['PATCH', `${foreign}/${remote.id}`, { name: 'Negado' }],
        ['DELETE', `${foreign}/${remote.id}`, undefined], ['PATCH', `${foreign}/${remote.id}/points/${remote.points[0].id}`, { name: 'Negado' }],
        ['DELETE', `${foreign}/${remote.id}/points/${remote.points[0].id}`, undefined]] as const)
        assert.equal((await call(method, url, body)).statusCode, 403);
      assert.equal((await call('GET', path.replace(a, c))).statusCode, 404);
      assert.equal((await call('GET', `${path}/${remote.id}`)).statusCode, 404);
      assert.equal((await call('POST', path.replace(path.split('/')[9]!, randomUUID()), { name: 'Cruzada', pointCount: 8 })).statusCode, 404);
      for (const method of ['PATCH', 'DELETE'] as const) assert.equal((await call(method, `${path}/${d.id}/points/${remote.points[0].id}`, method === 'PATCH' ? { name: 'Negado' } : undefined)).statusCode, 404);
      assert.equal((await call('GET', path, undefined, '')).statusCode, 401);
      await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'viewer' }, admin);
      assert.equal((await call('PATCH', `${path}/${d.id}`, { name: 'Negado' })).statusCode, 403);
      await call('DELETE', `/api/admin/users/${uid}/permissions/${a}`, undefined, admin);
      assert.equal((await call('GET', path)).statusCode, 404);
      await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'manager' }, admin);
    });
    await t.test('remoção explícita de pontos livres e mesa vazia, sem cascata', async () => {
      assert.equal((await resize(0)).statusCode, 200); d = await get(); assert.equal(d.points.length, 0);
      assert.equal((await call('DELETE', `${path}/${d.id}`)).statusCode, 204);
      assert.equal((await call('GET', `${path}/${d.id}`)).statusCode, 404);
      assert.equal((await pool.query('SELECT id FROM points WHERE desk_id=$1', [d.id])).rowCount, 0);
    });
  } finally {
    await app?.close(); await pool.end(); if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`); await root.end();
  }
});
