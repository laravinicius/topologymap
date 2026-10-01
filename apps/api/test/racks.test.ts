import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import type { EquipmentDetail, RackDetail } from '@topologia-new/domain';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';

test('etapa 07: racks, equipamentos e portas em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test07_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 10 });
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false;
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let admin = '', user = '', uid = '', a = '', b = '', c = '', path = '', other = '', denied = '', r: RackDetail, panel: EquipmentDetail, panel48: EquipmentDetail, generic: EquipmentDetail;
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
      const base = `/api/companies/${company}/units`, unit = await create(base, { name: 'Matriz QA', classification: 'Matriz' });
      const dc = await create(`${base}/${unit.id}/datacenters`, { name: 'DC QA' });
      return `${base}/${unit.id}/datacenters/${dc.id}/racks`;
    }
    const eq = () => `${path}/${r.id}/equipment`;
    const body = (name: string, startU: number, heightU = 1, portCount?: number) => ({ name, kind: portCount === undefined ? 'generic' : 'patch_panel', equipmentType: portCount === undefined ? 'Servidor' : 'Patch panel Cat6', startU, heightU, ...(portCount === undefined ? {} : { portCount }) });
    async function getPanel() { const response = await call('GET', `${eq()}/${panel.id}`); assert.equal(response.statusCode, 200); return response.json<EquipmentDetail>(); }
    async function resize(n: number, expected = panel.ports.map(p => p.id), extra = {}) { return call('PATCH', `${eq()}/${panel.id}`, { portCount: n, expectedPortIds: expected, ...extra }); }
    await t.test('hierarquia atual, múltiplas U, patch panels 24/48 e adjacência', async () => {
      admin = await login('admin.qa');
      a = (await create('/api/admin/companies', { name: 'A QA' })).id;
      b = (await create('/api/admin/companies', { name: 'B QA' })).id;
      c = (await create('/api/admin/companies', { name: 'C QA' })).id;
      uid = (await create('/api/admin/users', { name: 'Gestor QA', login: 'manager.qa', password })).id;
      await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'manager' }, admin);
      await call('PUT', `/api/admin/users/${uid}/permissions/${b}`, { role: 'viewer' }, admin);
      user = await login('manager.qa'); path = await hierarchy(a); other = await hierarchy(b); denied = await hierarchy(c);
      r = await create(path, { name: ' Rack 01 ', capacityU: 42 }, user);
      generic = await create(eq(), body('Servidor 3U', 1, 3), user);
      panel = await create(eq(), body('PP24', 4, 1, 24), user);
      panel48 = await create(eq(), body('PP48', 5, 2, 48), user);
      assert.equal(generic.heightU, 3); assert.deepEqual(generic.ports, []);
      assert.equal(panel.portCount, 24); assert.equal(panel48.portCount, 48);
      assert.deepEqual(panel.ports.map(p => p.name), Array.from({ length: 24 }, (_, i) => `Porta ${i + 1}`));
      assert.ok(panel48.ports.every(p => p.connectionId === null && p.equipmentId === panel48.id && p.companyId === a));
      assert.equal((await call('GET', `${path}/${r.id}`)).json().equipmentCount, 3);
      assert.equal((await call('POST', path, { name: r.name, capacityU: 10 })).statusCode, 409);
      const dc2 = await create(path.split('/').slice(0, -2).join('/'), { name: 'DC 2' });
      await create(`${path.split('/').slice(0, -2).join('/')}/${dc2.id}/racks`, { name: r.name, capacityU: 42 }, user);
    });
    await t.test('limites positivos/inteiros, payload fechado, tipo e contagem', async () => {
      for (const value of [0, -1, 1.5, '42', 1001, null]) {
        assert.equal((await call('POST', path, { name: 'Inválido', capacityU: value })).statusCode, 400);
        for (const field of ['startU', 'heightU']) assert.equal((await call('POST', eq(), { ...body('Inválido', 10), [field]: value })).statusCode, 400);
      }
      for (const value of [0, -1, 1.5, '24', 513, null]) assert.equal((await call('POST', eq(), { ...body('Inválido', 10, 1, 24), portCount: value })).statusCode, 400);
      for (const input of [{ ...body(' ', 10) }, { ...body('X', 10), equipmentType: ' ' }, { ...body('X', 10), kind: 'switch' },
        { ...body('X', 10), portCount: 24 }, { ...body('X', 10), kind: 'patch_panel' }, { ...body('X', 10), rackId: randomUUID() }])
        assert.equal((await call('POST', eq(), input)).statusCode, 400, JSON.stringify(input));
      assert.equal((await call('PATCH', `${eq()}/${panel.id}`, { portCount: 48 })).statusCode, 400);
      assert.equal((await call('PATCH', `${eq()}/${panel.id}`, { kind: 'generic' })).statusCode, 400);
      assert.equal((await call('PATCH', `${eq()}/${generic.id}`, { portCount: 1, expectedPortIds: [] })).statusCode, 400);
      assert.equal((await call('GET', `${path}/invalid`)).statusCode, 400);
      assert.match((await call('POST', eq(), { ...body('X', 10), startU: 0 })).json().message, /U inicial.*1 e 1000/);
      const max = await create(eq(), body('PP512', 40, 1, 512), user); assert.equal(max.ports.length, 512);
    });
    await t.test('sobreposição, equipamento maior que capacidade e conflito compreensível', async () => {
      for (const input of [body('Sobreposto 1', 3, 2), body('Sobreposto 2', 6, 2), body('Fora', 42, 2)]) {
        const result = await call('POST', eq(), input); assert.equal(result.statusCode, 409); assert.match(result.json().message, /ocupadas|42 U/);
      }
      assert.equal((await call('PATCH', `${eq()}/${generic.id}`, { startU: 4 })).statusCode, 409);
      assert.equal((await call('PATCH', `${path}/${r.id}`, { capacityU: 5, name: 'Não salvar' })).statusCode, 409);
      assert.equal((await call('GET', `${path}/${r.id}`)).json().name, r.name);
    });
    await t.test('falha no lote desfaz equipamento e todas as portas', async () => {
      await pool.query(`CREATE FUNCTION qa_fail_port() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.ordinal=12 AND EXISTS(SELECT 1 FROM equipment WHERE id=NEW.equipment_id AND name='Rollback QA') THEN
          RAISE EXCEPTION 'Falha sintética' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER qa_fail BEFORE INSERT ON ports FOR EACH ROW EXECUTE FUNCTION qa_fail_port()`);
      assert.equal((await call('POST', eq(), body('Rollback QA', 10, 1, 24))).statusCode, 503);
      assert.equal((await pool.query("SELECT id FROM equipment WHERE name='Rollback QA'")).rowCount, 0);
      assert.equal((await pool.query('SELECT id FROM ports WHERE equipment_id NOT IN (SELECT id FROM equipment)')).rowCount, 0);
      await pool.query('DROP TRIGGER qa_fail ON ports; DROP FUNCTION qa_fail_port()');
    });
    await t.test('editar nomes/posição/altura e ampliar mantém IDs e grafia', async () => {
      const original = panel;
      assert.equal((await call('PATCH', `${eq()}/${panel.id}/ports/${panel.ports[0]!.id}`, { name: ' Porta 099 Freso ' })).statusCode, 200);
      assert.equal((await call('PATCH', `${eq()}/${panel.id}`, { name: ' PP renomeado ', equipmentType: 'Cat6A', startU: 10, heightU: 2 })).statusCode, 200);
      assert.equal((await resize(48)).statusCode, 200); panel = await getPanel();
      assert.equal(panel.id, original.id); assert.equal(panel.createdAt, original.createdAt); assert.equal(panel.startU, 10); assert.equal(panel.heightU, 2);
      assert.equal(panel.ports[0]!.name, ' Porta 099 Freso ');
      assert.deepEqual(panel.ports.slice(0, 24).map(p => p.id), original.ports.map(p => p.id));
      assert.equal((await resize(24, original.ports.map(p => p.id))).statusCode, 409);
      const updated = await call('PATCH', `${path}/${r.id}`, { name: 'Rack revisado', capacityU: 48 }); assert.equal(updated.statusCode, 200); assert.equal(updated.json().id, r.id);
      assert.equal((await pool.query('SELECT DISTINCT rack_capacity_u FROM equipment WHERE rack_id=$1', [r.id])).rows[0].rack_capacity_u, 48);
      // Nome não define quantidade nem sequência; próxima sugestão não colide com nome editado.
      await call('PATCH', `${eq()}/${panel.id}/ports/${panel.ports[1]!.id}`, { name: 'Porta 49' });
      assert.equal((await resize(49)).statusCode, 200); panel = await getPanel(); assert.equal(panel.ports.at(-1)!.name, 'Porta 50');
      assert.equal((await call('PATCH', `${eq()}/${panel.id}/ports/${panel.ports[1]!.id}`, { name: panel.ports[0]!.name })).statusCode, 409);
    });
    let pointId = '', connectionId = '';
    await t.test('reduções/exclusões protegem vínculos e rollback dos demais campos', async () => {
      const unit = path.split('/')[5];
      const f = await create(`/api/companies/${a}/units/${unit}/floors`, { name: 'Andar QA' });
      const p = await create(`/api/companies/${a}/units/${unit}/floors/${f.id}/plans`, { name: 'Planta QA' });
      const d = await create(`/api/companies/${a}/units/${unit}/floors/${f.id}/plans/${p.id}/desks`, { name: 'Mesa QA', pointCount: 2 });
      pointId = d.points[0].id;
      connectionId = (await pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [a, pointId, panel.ports.at(-1)!.id])).rows[0].id;
      assert.equal((await resize(24, undefined, { name: 'Não salvar', startU: 20 })).statusCode, 409);
      assert.equal((await call('DELETE', `${eq()}/${panel.id}/ports/${panel.ports.at(-1)!.id}`)).statusCode, 409);
      assert.equal((await call('DELETE', `${eq()}/${panel.id}`)).statusCode, 409);
      assert.equal((await call('DELETE', `${path}/${r.id}`)).statusCode, 409);
      const before = panel; panel = await getPanel(); assert.equal(panel.portCount, 49); assert.equal(panel.name, before.name); assert.equal(panel.startU, 10);
      assert.equal(panel.ports.at(-1)!.connectionId, connectionId);
      assert.equal((await call('PATCH', `${eq()}/${panel.id}`, { startU: 20, heightU: 3 })).statusCode, 200);
      panel = await getPanel(); assert.equal(panel.ports.at(-1)!.connectionId, connectionId);
      assert.equal((await call('PATCH', `${path}/${r.id}`, { capacityU: 21 })).statusCode, 409);
      await pool.query('DELETE FROM connections WHERE id=$1', [connectionId]);
      const retained = panel.ports.slice(0, 24).map(p => p.id);
      assert.equal((await resize(24)).statusCode, 200); panel = await getPanel(); assert.deepEqual(panel.ports.map(p => p.id), retained);
    });
    await t.test('concorrência na API: sobreposição e quantidades desatualizadas', async () => {
      const positions = await Promise.all([call('POST', eq(), body('Concorrente A', 30, 2)), call('POST', eq(), body('Concorrente B', 31, 2))]);
      assert.deepEqual(positions.map(p => p.statusCode).sort(), [201, 409]);
      const quantities = await Promise.all([resize(25), resize(26)]);
      assert.deepEqual(quantities.map(p => p.statusCode).sort(), [200, 409]); panel = await getPanel();
    });
    await t.test('EXCLUDE protege sobreposição concorrente por SQL sem passar pela API', async () => {
      const left = await pool.connect(), right = await pool.connect();
      try {
        await left.query('BEGIN'); await right.query('BEGIN');
        const insert = `INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u)
          SELECT company_id,id,$2,'generic','Teste SQL',$3,2,capacity_u FROM racks WHERE id=$1`;
        await left.query(insert, [r.id, 'SQL A', 34]);
        const pending = right.query(insert, [r.id, 'SQL B', 35]);
        const checked = assert.rejects(pending, (e: unknown) => (e as { code: string }).code === '23P01');
        await left.query('COMMIT'); await checked; await right.query('ROLLBACK');
        assert.equal((await pool.query("SELECT id FROM equipment WHERE rack_id=$1 AND name IN ('SQL A','SQL B')", [r.id])).rowCount, 1);
      } finally { await left.query('ROLLBACK'); await right.query('ROLLBACK'); left.release(); right.release(); }
    });
    await t.test('corrida redução de capacidade contra instalação nunca excede capacidade', async () => {
      for (let i = 0; i < 4; i++) {
        const empty = await create(path, { name: `Corrida U ${i}`, capacityU: 42 }, user);
        const result = await Promise.allSettled([
          call('PATCH', `${path}/${empty.id}`, { capacityU: 10 }),
          pool.query(`INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u)
            SELECT company_id,id,'Topo','generic','Servidor',40,2,capacity_u FROM racks WHERE id=$1`, [empty.id]),
        ]);
        const reduction = result[0]!, installation = result[1]!;
        assert.equal(reduction.status, 'fulfilled');
        assert.equal(reduction.value.statusCode, installation.status === 'fulfilled' ? 409 : 200);
        if (installation.status === 'rejected') assert.ok(['23503', '23514'].includes(installation.reason.code));
        assert.equal((await pool.query('SELECT id FROM equipment WHERE rack_id=$1 AND start_u::bigint+height_u-1>rack_capacity_u', [empty.id])).rowCount, 0);
      }
    });
    await t.test('corrida remoção de porta contra conexão preserva integridade', async () => {
      for (let i = 0; i < 4; i++) {
        const port = panel.ports.at(-1)!;
        const results = await Promise.allSettled([
          pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [a, pointId, port.id]),
          call('DELETE', `${eq()}/${panel.id}/ports/${port.id}`),
        ]);
        const connection = results[0]!, deletion = results[1]!; assert.equal(deletion.status, 'fulfilled');
        if (connection.status === 'fulfilled') {
          assert.equal(deletion.value.statusCode, 409);
          await pool.query('DELETE FROM connections WHERE id=$1', [connection.value.rows[0].id]);
        } else { assert.equal(deletion.value.statusCode, 204); assert.equal(connection.reason.code, '23503'); }
        panel = await getPanel();
      }
    });
    await t.test('isolamento, viewer, referências cruzadas e revogação com sessão existente', async () => {
      const foreignRack = await create(other, { name: 'B Rack', capacityU: 42 }), foreignEquipment = await create(`${other}/${foreignRack.id}/equipment`, body('B Panel', 1, 1, 24));
      assert.equal((await call('GET', `${other}/${foreignRack.id}`)).statusCode, 200);
      for (const [method, url, payload] of [['POST', other, { name: 'Não', capacityU: 42 }], ['PATCH', `${other}/${foreignRack.id}`, { capacityU: 48 }],
        ['POST', `${other}/${foreignRack.id}/equipment`, body('Não', 10)], ['PATCH', `${other}/${foreignRack.id}/equipment/${foreignEquipment.id}/ports/${foreignEquipment.ports[0].id}`, { name: 'Não' }],
        ['DELETE', `${other}/${foreignRack.id}/equipment/${foreignEquipment.id}/ports/${foreignEquipment.ports[0].id}`, undefined]] as const)
        assert.equal((await call(method, url, payload)).statusCode, 403);
      assert.equal((await call('GET', denied)).statusCode, 404);
      assert.equal((await call('GET', `${path}/${foreignRack.id}`)).statusCode, 404);
      assert.equal((await call('GET', `${eq()}/${foreignEquipment.id}`)).statusCode, 404);
      assert.equal((await call('PATCH', `${eq()}/${panel.id}/ports/${foreignEquipment.ports[0].id}`, { name: 'Não' })).statusCode, 404);
      assert.equal((await call('GET', path, undefined, '')).statusCode, 401);
      await call('PUT', `/api/admin/users/${uid}/permissions/${a}`, { role: 'viewer' }, admin);
      assert.equal((await call('PATCH', `${path}/${r.id}`, { name: 'Não' })).statusCode, 403);
      await call('DELETE', `/api/admin/users/${uid}/permissions/${a}`, undefined, admin);
      assert.equal((await call('GET', path)).statusCode, 404);
    });
    await t.test('remoção explícita de portas livres, equipamento e rack vazio', async () => {
      const empty = await create(path, { name: 'Excluir rack', capacityU: 10 }), e = await create(`${path}/${empty.id}/equipment`, body('Excluir panel', 1, 1, 1));
      assert.equal((await call('DELETE', `${path}/${empty.id}/equipment/${e.id}/ports/${e.ports[0].id}`, undefined, admin)).statusCode, 204);
      assert.equal((await call('DELETE', `${path}/${empty.id}/equipment/${e.id}`, undefined, admin)).statusCode, 204);
      assert.equal((await call('DELETE', `${path}/${empty.id}`, undefined, admin)).statusCode, 204);
      assert.equal((await call('GET', `${path}/${empty.id}`, undefined, admin)).statusCode, 404);
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`); await root.end();
  }
});
