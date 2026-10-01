import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import type { ConnectionDetail, DeskDetail, EquipmentDetail } from '@topologia-new/domain';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';

test('etapa 08: conexões transacionais, estado esperado e concorrência em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test08_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 12 });
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false;
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let admin = '', user = '', uid = '', a = '', b = '', denied = '';
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
    const base = (company = a) => `/api/companies/${company}`;
    const expected = (c: ConnectionDetail) => ({ revision: c.revision, pointId: c.pointId, portId: c.portId });
    const bind = (pointId: string, portId: string, company = a, cookie = user) => call('POST', `${base(company)}/connections`, { pointId, portId }, cookie);
    const transfer = (c: ConnectionDetail, pointId: string, portId: string, cookie = user) => call('POST', `${base()}/connections/${c.id}/transfer`, { expected: expected(c), pointId, portId }, cookie);
    const unlink = (c: ConnectionDetail, cookie = user) => call('DELETE', `${base()}/connections/${c.id}`, { expected: expected(c) }, cookie);
    async function endpoint(side: 'points' | 'ports', id: string, company = a) {
      const result = await call('GET', `${base(company)}/${side}/${id}/connection`); assert.equal(result.statusCode, 200, result.body); return result.json().connection as ConnectionDetail | null;
    }
    async function hierarchy(company: string) {
      const unit = await create(`${base(company)}/units`, { name: 'Matriz QA', classification: 'Matriz' });
      const floor = await create(`${base(company)}/units/${unit.id}/floors`, { name: 'Andar mesas' });
      const rackFloor = await create(`${base(company)}/units/${unit.id}/floors`, { name: 'Andar datacenter' });
      const planPath = `${base(company)}/units/${unit.id}/floors/${floor.id}/plans`;
      const plan = await create(planPath, { name: 'Planta mesas' });
      const rackPlan = await create(`${base(company)}/units/${unit.id}/floors/${rackFloor.id}/plans`, { name: 'Planta datacenter' });
      const deskPath = `${planPath}/${plan.id}/desks`, desk: DeskDetail = await create(deskPath, { name: 'Mesa QA', pointCount: 20 });
      const dc = await create(`${base(company)}/units/${unit.id}/datacenters`, { name: 'DC QA' });
      const rackPath = `${base(company)}/units/${unit.id}/datacenters/${dc.id}/racks`, rack = await create(rackPath, { name: 'Rack QA', capacityU: 42 });
      // Filiação espacial existente no modelo, ainda sem editor nesta etapa.
      await pool.query('UPDATE racks SET plan_id=$2 WHERE id=$1', [rack.id, rackPlan.id]);
      const eqPath = `${rackPath}/${rack.id}/equipment`;
      const panel: EquipmentDetail = await create(eqPath, { name: 'PP QA', kind: 'patch_panel', equipmentType: 'Cat6', startU: 1, heightU: 1, portCount: 24 });
      return { unit, floor, rackFloor, plan, rackPlan, planPath, desk, deskPath, dc, rack, rackPath, eqPath, panel };
    }
    admin = await login('admin.qa');
    a = (await create('/api/admin/companies', { name: 'A QA' })).id;
    b = (await create('/api/admin/companies', { name: 'B QA' })).id;
    denied = (await create('/api/admin/companies', { name: 'Sem acesso QA' })).id;
    uid = (await create('/api/admin/users', { name: 'Gestor QA', login: 'manager.qa', password })).id;
    assert.equal((await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'manager' }, admin)).statusCode, 200);
    assert.equal((await call('PUT', `/api/admin/users/${uid}/permissions/${b}`, { role: 'viewer' }, admin)).statusCode, 200);
    user = await login('manager.qa');
    const h = await hierarchy(a), foreign = await hierarchy(b);
    const pts = h.desk.points.map(p => p.id), ports = h.panel.ports.map(p => p.id);
    let first: ConnectionDetail;

    await t.test('associação consultada nos dois sentidos, caminho entre andares e consumidores', async () => {
      assert.equal(await endpoint('points', pts[0]!), null); assert.equal(await endpoint('ports', ports[0]!), null);
      const response = await bind(pts[0]!, ports[0]!); assert.equal(response.statusCode, 201, response.body); first = response.json();
      assert.equal(first.revision, 1); assert.equal(first.companyId, a);
      assert.equal(first.path.origin.floor.id, h.floor.id); assert.equal(first.path.destination.floor!.id, h.rackFloor.id);
      assert.notEqual(first.path.origin.floor.id, first.path.destination.floor!.id);
      assert.deepEqual(await endpoint('points', first.pointId), first); assert.deepEqual(await endpoint('ports', first.portId), first);
      assert.deepEqual((await call('GET', `${base()}/connections/${first.id}`)).json(), first);
      const desk = (await call('GET', `${h.deskPath}/${h.desk.id}`)).json<DeskDetail>();
      const panel = (await call('GET', `${h.eqPath}/${h.panel.id}`)).json<EquipmentDetail>();
      assert.deepEqual(desk.points[0]!.connection, first); assert.equal(desk.points[0]!.connectionId, first.id);
      assert.deepEqual(panel.ports[0]!.connection, first); assert.equal(panel.ports[0]!.connectionId, first.id);
      const allPoints = await call('GET', `${base()}/points`);
      assert.equal(allPoints.statusCode, 200, allPoints.body);
      assert.equal(allPoints.json().points.length, h.desk.pointCount);
      assert.deepEqual(allPoints.json().points.find((p: { id: string }) => p.id === first.pointId).connection, first);
      const rackFront = await call('GET', `${h.rackPath}/${h.rack.id}`);
      assert.equal(rackFront.statusCode, 200, rackFront.body);
      assert.deepEqual(rackFront.json().equipment[0].ports[0].connection, first);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM connections')).rows[0].n, 1);
    });
    await t.test('duplicidade, transferência ocupada e rollback preservam os dois vínculos', async () => {
      const second = (await bind(pts[1]!, ports[1]!)).json<ConnectionDetail>();
      for (const [p, q] of [[first.pointId, first.portId], [first.pointId, ports[2]!], [pts[2]!, first.portId]]) {
        const conflict = await bind(p!, q!); assert.equal(conflict.statusCode, 409); assert.match(conflict.json().message, /já possui conexão/);
      }
      for (const [p, q] of [[first.pointId, second.portId], [second.pointId, first.portId], [second.pointId, second.portId]])
        assert.equal((await transfer(first, p!, q!)).statusCode, 409);
      assert.deepEqual(await endpoint('points', first.pointId), first); assert.deepEqual(await endpoint('ports', second.portId), second);
      assert.equal((await unlink(second)).statusCode, 200);
    });
    await t.test('transferir porta, ponto e ambos preserva ID, incrementa revisão e libera antigos', async () => {
      for (const [p, q] of [[first.pointId, ports[2]!], [pts[2]!, ports[2]!], [pts[3]!, ports[3]!]]) {
        const old = first, response = await transfer(old, p!, q!); assert.equal(response.statusCode, 200, response.body); first = response.json();
        assert.equal(first.id, old.id); assert.equal(first.revision, old.revision + 1); assert.equal(first.createdAt, old.createdAt);
        assert.equal(first.pointId, p); assert.equal(first.portId, q);
        if (p !== old.pointId) assert.equal(await endpoint('points', old.pointId), null);
        if (q !== old.portId) assert.equal(await endpoint('ports', old.portId), null);
        assert.deepEqual(await endpoint('points', p!), first); assert.deepEqual(await endpoint('ports', q!), first);
        assert.equal((await transfer(old, pts[4]!, ports[4]!)).statusCode, 409);
        assert.equal((await unlink(old)).statusCode, 409); assert.deepEqual(await endpoint('points', first.pointId), first);
      }
    });
    await t.test('estado esperado completo, revisão numérica, corpos fechados e IDs válidos', async () => {
      for (const input of [{}, { expected: {} }, { expected: { revision: 1 } }, { expected: { ...expected(first), revision: '4' } },
        { expected: { ...expected(first), revision: 0 } }, { expected: { ...expected(first), revision: 1.5 } },
        { expected: { ...expected(first), revision: Number.MAX_SAFE_INTEGER + 1 } }, { expected: expected(first), companyId: b }])
        assert.equal((await call('DELETE', `${base()}/connections/${first.id}`, input)).statusCode, 400);
      assert.equal((await call('DELETE', `${base()}/connections/${first.id}`)).statusCode, 400);
      for (const wrong of [{ ...expected(first), pointId: pts[9]! }, { ...expected(first), portId: ports[9]! }, { ...expected(first), revision: 99 }])
        assert.equal((await call('DELETE', `${base()}/connections/${first.id}`, { expected: wrong })).statusCode, 409);
      assert.equal((await transfer(first, first.pointId, first.portId)).statusCode, 400);
      assert.equal((await bind('invalid', ports[8]!)).statusCode, 400);
      assert.equal((await bind(randomUUID(), ports[8]!)).statusCode, 404);
      assert.equal((await call('POST', `${base()}/connections`, { pointId: pts[8], portId: ports[8], revision: 1 })).statusCode, 400);
      assert.equal((await call('GET', `${base()}/points/${randomUUID()}/connection`)).statusCode, 404);
    });
    await t.test('renomear atualiza caminho sem recriar conexão; metadados de localização opcionais', async () => {
      const patch = async (url: string, name: string) => assert.equal((await call('PATCH', url, { name })).statusCode, 200);
      await patch(`${h.deskPath}/${h.desk.id}`, ' Mesa Renomeada ');
      await patch(`${h.deskPath}/${h.desk.id}/points/${first.pointId}`, 'Tomada Azul');
      await patch(`${h.rackPath}/${h.rack.id}`, 'Rack Renomeado');
      await patch(`${h.eqPath}/${h.panel.id}`, 'PP Renomeado');
      await patch(`${h.eqPath}/${h.panel.id}/ports/${first.portId}`, 'Porta Azul');
      const current = (await endpoint('points', first.pointId))!;
      assert.equal(current.id, first.id); assert.equal(current.revision, first.revision);
      assert.equal(current.path.origin.desk.name, ' Mesa Renomeada '); assert.equal(current.path.origin.point.name, 'Tomada Azul');
      assert.equal(current.path.destination.rack.name, 'Rack Renomeado'); assert.equal(current.path.destination.patchPanel.name, 'PP Renomeado');
      assert.equal(current.path.destination.port.name, 'Porta Azul'); assert.deepEqual(await endpoint('ports', first.portId), current); first = current;
      await pool.query('UPDATE racks SET plan_id=NULL WHERE id=$1', [h.rack.id]);
      const unplaced = (await endpoint('ports', first.portId))!; assert.equal(unplaced.path.destination.plan, null); assert.equal(unplaced.path.destination.floor, null);
      await pool.query('UPDATE racks SET plan_id=$2 WHERE id=$1', [h.rack.id, h.rackPlan.id]);
    });

    // Locks de um terceiro cliente forçam ambas as requisições a estarem em voo no banco.
    async function race(table: 'points' | 'ports' | 'connections', id: string, sql: string, operations: () => ReturnType<typeof call>[]) {
      const gate = await pool.connect(); let pending: ReturnType<typeof call>[] = [];
      try {
        await gate.query('BEGIN'); await gate.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
        pending = operations();
        const deadline = Date.now() + 5000; let waiting = 0;
        while (Date.now() < deadline) {
          waiting = (await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1`, [`${sql}%`])).rows[0].n;
          if (waiting >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(waiting, 2, 'Duas requisições devem disputar locks reais no PostgreSQL');
      } finally { await gate.query('ROLLBACK'); gate.release(); }
      return Promise.all(pending);
    }
    await t.test('duas associações simultâneas por ponto e por porta: exatamente um sucesso', async () => {
      for (const side of ['points', 'ports'] as const) {
        const i = side === 'points' ? 5 : 7;
        const pairs = side === 'points' ? [[pts[i]!, ports[i]!], [pts[i]!, ports[i + 1]!]] : [[pts[i]!, ports[i]!], [pts[i + 1]!, ports[i]!]];
        const results = await race(side, side === 'points' ? pts[i]! : ports[i]!, 'INSERT INTO connections', () => pairs.map(([p, q]) => bind(p!, q!)));
        assert.deepEqual(results.map(r => r.statusCode).sort(), [201, 409]);
        const winner = results.find(r => r.statusCode === 201)!.json<ConnectionDetail>();
        assert.deepEqual(await endpoint('points', winner.pointId), winner); assert.deepEqual(await endpoint('ports', winner.portId), winner);
        const rows = await pool.query(`SELECT count(*)::int AS n FROM connections WHERE ${side === 'points' ? 'point_id' : 'port_id'}=$1`, [side === 'points' ? pts[i] : ports[i]]);
        assert.equal(rows.rows[0].n, 1); assert.equal((await unlink(winner)).statusCode, 200);
      }
    });
    await t.test('duas transferências simultâneas do mesmo estado: só uma revisa a conexão', async () => {
      const current = (await endpoint('points', first.pointId))!;
      const results = await race('connections', current.id, 'UPDATE connections', () => [transfer(current, pts[10]!, ports[10]!), transfer(current, pts[11]!, ports[11]!)]);
      assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
      first = results.find(r => r.statusCode === 200)!.json(); assert.equal(first.revision, current.revision + 1);
      assert.equal(await endpoint('points', current.pointId), null); assert.equal(await endpoint('ports', current.portId), null);
      assert.equal((await unlink(current)).statusCode, 409);
    });
    await t.test('transferências concorrentes disputando a mesma extremidade preservam perdedor', async () => {
      for (const side of ['points', 'ports'] as const) {
        const left = (await bind(pts[12]!, ports[12]!)).json<ConnectionDetail>();
        const right = (await bind(pts[13]!, ports[13]!)).json<ConnectionDetail>();
        const results = await race(side, side === 'points' ? pts[14]! : ports[14]!, 'UPDATE connections', () =>
          [left, right].map(c => transfer(c, side === 'points' ? pts[14]! : c.pointId, side === 'ports' ? ports[14]! : c.portId)));
        assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
        const winner = results.find(r => r.statusCode === 200)!.json<ConnectionDetail>(), loser = winner.id === left.id ? right : left;
        assert.deepEqual(await endpoint('points', loser.pointId), loser);
        assert.equal((await unlink(winner)).statusCode, 200); assert.equal((await unlink(loser)).statusCode, 200);
      }
    });
    await t.test('desvinculação contra transferência em voo revalida o estado após esperar lock', async () => {
      const current = first;
      const results = await race('connections', current.id, '', () => [unlink(current), transfer(current, pts[15]!, ports[15]!)]);
      assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
      if (results[0]!.statusCode === 200) {
        assert.equal(await endpoint('points', current.pointId), null); assert.equal(await endpoint('ports', current.portId), null);
        assert.equal(await endpoint('points', pts[15]!), null); assert.equal(await endpoint('ports', ports[15]!), null);
        first = (await bind(current.pointId, current.portId)).json();
      } else {
        first = results[1]!.json(); assert.equal(first.revision, current.revision + 1);
        assert.deepEqual(await endpoint('ports', first.portId), first);
      }
      assert.equal((await unlink(current)).statusCode, 409);
    });
    await t.test('desvinculação obsoleta após remoção e nova associação não remove vínculo novo', async () => {
      const old = first; const response = await unlink(old); assert.equal(response.statusCode, 200); assert.equal(response.json().connection, null);
      assert.equal(await endpoint('points', old.pointId), null); assert.equal(await endpoint('ports', old.portId), null);
      first = (await bind(old.pointId, old.portId)).json(); assert.notEqual(first.id, old.id); assert.equal(first.revision, 1);
      assert.equal((await unlink(old)).statusCode, 409); assert.equal((await transfer(old, pts[15]!, ports[15]!)).statusCode, 409);
      assert.deepEqual(await endpoint('points', first.pointId), first);
    });
    await t.test('isolamento de empresas na API e nas FKs, incluindo administrador', async () => {
      for (const cookie of [admin, user]) {
        assert.equal((await bind(pts[16]!, foreign.panel.ports[0]!.id, a, cookie)).statusCode, 404);
        assert.equal((await bind(foreign.desk.points[0]!.id, ports[16]!, a, cookie)).statusCode, 404);
        assert.equal((await transfer(first, first.pointId, foreign.panel.ports[0]!.id, cookie)).statusCode, 404);
        assert.equal((await call('GET', `${base()}/ports/${foreign.panel.ports[0]!.id}/connection`, undefined, cookie)).statusCode, 404);
      }
      assert.equal((await call('GET', `${base(denied)}/points/${pts[0]}/connection`)).statusCode, 404);
      await assert.rejects(pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a, pts[16], foreign.panel.ports[0]!.id]), { code: '23503' });
      await assert.rejects(pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a, first.pointId, ports[16]]), { code: '23505' });
      await assert.rejects(pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a, pts[16], first.portId]), { code: '23505' });
      assert.deepEqual(await endpoint('points', first.pointId), first);
    });
    await t.test('viewer não escreve; revogação/desativação valem com a sessão existente', async () => {
      const fc = (await bind(foreign.desk.points[0]!.id, foreign.panel.ports[0]!.id, b, admin)).json<ConnectionDetail>();
      assert.equal((await call('GET', `${base(b)}/connections/${fc.id}`)).statusCode, 200);
      assert.equal((await bind(foreign.desk.points[1]!.id, foreign.panel.ports[1]!.id, b)).statusCode, 403);
      assert.equal((await call('POST', `${base(b)}/connections/${fc.id}/transfer`, { pointId: fc.pointId, portId: foreign.panel.ports[1]!.id, expected: expected(fc) })).statusCode, 403);
      assert.equal((await call('DELETE', `${base(b)}/connections/${fc.id}`, { expected: expected(fc) })).statusCode, 403);
      assert.equal((await call('GET', `${base()}/connections/${first.id}`, undefined, '')).statusCode, 401);
      assert.equal((await app!.inject({ method: 'POST', url: `${base()}/connections`, headers: { origin: 'http://invalid.local', cookie: user }, payload: { pointId: pts[16], portId: ports[16] } })).statusCode, 403);
      await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'viewer' }, admin);
      assert.equal((await unlink(first)).statusCode, 403); assert.equal((await transfer(first, pts[16]!, ports[16]!)).statusCode, 403);
      await call('DELETE', `/api/admin/users/${uid}/permissions/${a}`, undefined, admin);
      assert.equal((await call('GET', `${base()}/connections/${first.id}`)).statusCode, 404);
      await call('PATCH', `/api/admin/users/${uid}`, { isActive: false }, admin);
      assert.equal((await call('GET', `${base(b)}/connections/${fc.id}`)).statusCode, 401);
      assert.equal((await unlink(first, admin)).statusCode, 200);
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`); await root.end();
  }
});
