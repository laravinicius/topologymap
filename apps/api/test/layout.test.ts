import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { hashPassword } from '../src/auth/password.js';

test('etapa 11: layout estruturado, revisão e referências canônicas em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test11_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 8 });
  const password = randomBytes(24).toString('hex'), viewerPassword = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false, cookie = '';
  let company = '', companyB = '', plan = '', planB = '', desk = '', deskB = '', rack = '', sector = '', sectorB = '', point = '', port = '', connection = '';
  try {
    assert.notEqual(database, config.database);
    await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool);
    await provisionAdmin(pool, { login: 'admin.layout.qa', name: 'Admin layout QA', password });
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800 });
    const call = (method: 'GET' | 'PUT' | 'POST', url: string, payload?: object) => app!.inject({ method, url, headers: { origin, ...(cookie ? { cookie } : {}) }, ...(payload ? { payload } : {}) });
    const login = await call('POST', '/api/auth/login', { login: 'admin.layout.qa', password });
    assert.equal(login.statusCode, 200); cookie = login.headers['set-cookie']!.toString().split(';')[0]!;
    company = (await pool.query("INSERT INTO companies(name) VALUES ('Empresa layout QA') RETURNING id")).rows[0]!.id;
    const unit = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Unidade layout QA') RETURNING id", [company])).rows[0]!.id;
    const floor = (await pool.query("INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,'Andar layout QA') RETURNING id", [company, unit])).rows[0]!.id;
    plan = (await pool.query("INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,'Planta layout QA') RETURNING id", [company, unit, floor])).rows[0]!.id;
    desk = (await pool.query("INSERT INTO desks(company_id,plan_id,name,placement) VALUES ($1,$2,'Mesa layout QA',$3) RETURNING id", [company, plan, JSON.stringify({ x: 1, y: 2, width: 1.2, height: 0.6, rotation: 0 })])).rows[0]!.id;
    point = (await pool.query("INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,'Ponto 1',1) RETURNING id", [company, desk])).rows[0]!.id;
    sector = (await pool.query("INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,'Setor QA',$3) RETURNING id", [company, plan, JSON.stringify([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }])])).rows[0]!.id;
    await pool.query('UPDATE desks SET sector_id=$2 WHERE id=$1', [desk, sector]);
    const dc = (await pool.query("INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,'DC layout QA') RETURNING id", [company, unit])).rows[0]!.id;
    rack = (await pool.query("INSERT INTO racks(company_id,unit_id,datacenter_id,plan_id,name,capacity_u,placement) VALUES ($1,$2,$3,$4,'Rack layout QA',24,$5) RETURNING id", [company, unit, dc, plan, JSON.stringify({ x: 8, y: 3, width: 0.8, height: 2, rotation: 0 })])).rows[0]!.id;
    const equip = (await pool.query("INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u) VALUES ($1,$2,'PP QA','patch_panel','Patch panel',1,1,24) RETURNING id", [company, rack])).rows[0]!.id;
    port = (await pool.query("INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Porta 1',1) RETURNING id", [company, equip])).rows[0]!.id;
    connection = (await pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [company, point, port])).rows[0]!.id;
    companyB = (await pool.query("INSERT INTO companies(name) VALUES ('Empresa B layout QA') RETURNING id")).rows[0]!.id;
    const unitB = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Unidade B layout QA') RETURNING id", [companyB])).rows[0]!.id;
    const floorB = (await pool.query("INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,'Andar B layout QA') RETURNING id", [companyB, unitB])).rows[0]!.id;
    planB = (await pool.query("INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,'Planta B layout QA') RETURNING id", [companyB, unitB, floorB])).rows[0]!.id;
    deskB = (await pool.query("INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Mesa B layout QA') RETURNING id", [companyB, planB])).rows[0]!.id;
    sectorB = (await pool.query("INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,'Setor B layout QA',$3) RETURNING id", [companyB, planB, JSON.stringify([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }])])).rows[0]!.id;
    const url = `/api/companies/${company}/plans/${plan}/layout`;
    const read = async () => { const result = await call('GET', url); assert.equal(result.statusCode, 200, result.body); return result.json() as { revision: number; layout: any }; };
    const save = (revision: number, layout: unknown) => call('PUT', url, { expectedRevision: revision, layout } as object);

    await t.test('leitura reúne IDs/posições e salvamento atualiza somente geometria canônica', async () => {
      const first = await read();
      assert.equal(first.revision, 5); // criação de mesa, setor, vínculo ao setor e rack avançam a revisão
      assert.deepEqual(first.layout.desks.map((item: { id: string }) => item.id), [desk]);
      assert.deepEqual(first.layout.racks.map((item: { id: string }) => item.id), [rack]);
      assert.deepEqual(first.layout.sectors.map((item: { id: string }) => item.id), [sector]);
      const layout = structuredClone(first.layout);
      const cableTables = ['points', 'equipment', 'ports', 'connections'];
      const cables = [];
      for (const table of cableTables) cables.push((await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).rows);
      layout.geometry.walls = Array.from({ length: 60 }, (_, index) => ({ id: `parede-${index}`, start: { x: 0, y: index }, end: { x: 10, y: index }, thickness: 0.15 }));
      layout.geometry.openings = [{ id: 'porta-1', kind: 'door', wallId: 'parede-1', offset: 1, width: 0.9 }];
      layout.camera = { x: 128, y: -64, zoom: 1.5 };
      layout.desks[0].placement = { x: 3, y: 4, width: 1.2, height: 0.6, rotation: 90 };
      layout.racks[0].placement = { x: 9, y: 4, width: 0.8, height: 2, rotation: 0 };
      layout.sectors[0].polygon = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }];
      const written = await save(first.revision, layout); assert.equal(written.statusCode, 200, written.body);
      assert.equal(written.json().revision, first.revision + 1);
      const after = await read(); assert.deepEqual(after.layout, layout);
      for (const [i, table] of cableTables.entries())
        assert.deepEqual((await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).rows, cables[i], `${table} deve permanecer integralmente idêntica`);
      assert.equal((await pool.query('SELECT sector_id FROM desks WHERE id=$1', [desk])).rows[0]!.sector_id, sector);
      assert.equal((await pool.query('SELECT id FROM connections WHERE id=$1 AND point_id=$2 AND port_id=$3', [connection, point, port])).rowCount, 1);
      assert.equal((await pool.query('SELECT count(*)::int n FROM points WHERE desk_id=$1', [desk])).rows[0]!.n, 1);
    });

    await t.test('rejeita revisões antigas, IDs duplicados e referências inexistentes/cruzadas', async () => {
      const current = await read(), layout = structuredClone(current.layout);
      assert.equal((await save(current.revision - 1, layout)).statusCode, 409);
      layout.desks.push(structuredClone(layout.desks[0]));
      assert.equal((await save(current.revision, layout)).statusCode, 400);
      const duplicateAcrossKinds = structuredClone(current.layout);
      duplicateAcrossKinds.racks[0].id = duplicateAcrossKinds.desks[0].id;
      assert.equal((await save(current.revision, duplicateAcrossKinds)).statusCode, 400);
      const valid = structuredClone(current.layout);
      valid.racks[0].id = '00000000-0000-4000-8000-000000000001';
      assert.equal((await save(current.revision, valid)).statusCode, 409);
      const crossCompany = structuredClone(current.layout);
      crossCompany.desks[0].id = deskB;
      assert.equal((await save(current.revision, crossCompany)).statusCode, 409);
      crossCompany.desks[0].id = desk;
      crossCompany.sectors[0].id = sectorB;
      assert.equal((await save(current.revision, crossCompany)).statusCode, 409);
      valid.racks = [];
      assert.equal((await save(current.revision, valid)).statusCode, 409);
      assert.equal((await call('GET', `/api/companies/${company}/plans/${planB}/layout`)).statusCode, 404);
    });

    await t.test('duas gravações concorrentes com a mesma revisão: somente uma é aceita', async () => {
      const base = await read();
      const left = structuredClone(base.layout), right = structuredClone(base.layout);
      left.camera = { x: 10, y: 20, zoom: 1.1 }; right.camera = { x: 30, y: 40, zoom: 1.2 };
      left.desks[0].placement.x = 15; right.racks[0].placement.x = 16;
      const [a, b] = await Promise.all([save(base.revision, left), save(base.revision, right)]);
      assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
      const final = await read(); assert.equal(final.revision, base.revision + 1);
      assert.deepEqual(final.layout, a.statusCode === 200 ? left : right);
    });

    await t.test('referências de cada tipo exigem IDs únicos e a planta correta na mesma empresa', async () => {
      const otherPlan = (await pool.query("INSERT INTO plans(company_id,unit_id,floor_id,name) SELECT company_id,unit_id,floor_id,'Outra planta layout QA' FROM plans WHERE id=$1 RETURNING id", [plan])).rows[0]!.id;
      const otherDesk = (await pool.query("INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Outra mesa QA') RETURNING id", [company, otherPlan])).rows[0]!.id;
      const otherSector = (await pool.query("INSERT INTO sectors(company_id,plan_id,name,polygon) SELECT company_id,$2,'Outro setor QA',polygon FROM sectors WHERE id=$1 RETURNING id", [sector, otherPlan])).rows[0]!.id;
      const otherRack = (await pool.query("INSERT INTO racks(company_id,unit_id,datacenter_id,plan_id,name,capacity_u) SELECT company_id,unit_id,datacenter_id,$2,'Outro rack QA',24 FROM racks WHERE id=$1 RETURNING id", [rack, otherPlan])).rows[0]!.id;
      const current = await read();
      for (const [collection, foreignId] of [['desks', otherDesk], ['racks', otherRack], ['sectors', otherSector]]) {
        for (const replacement of [foreignId, '00000000-0000-4000-8000-000000000001']) {
          const layout = structuredClone(current.layout); layout[collection!][0].id = replacement;
          assert.equal((await save(current.revision, layout)).statusCode, 409, collection);
        }
        const duplicate = structuredClone(current.layout); duplicate[collection!].push(structuredClone(duplicate[collection!][0]));
        assert.equal((await save(current.revision, duplicate)).statusCode, 400, collection);
        duplicate[collection!][1].id = duplicate[collection!][1].id.toUpperCase();
        assert.equal((await save(current.revision, duplicate)).statusCode, 400, collection);
      }
      assert.deepEqual(await read(), current);
    });

    await t.test('documento rejeita cópias cadastrais, campos do renderizador e novas referências de arquivos', async () => {
      const current = await read();
      for (const corrupt of [
        (layout: any) => { layout.geometry.desks = layout.desks; },
        (layout: any) => { layout.connections = []; },
        (layout: any) => { layout.geometry.walls[0].attrs = { x: 1 }; },
        (layout: any) => { layout.camera.scaleX = 2; },
        (layout: any) => { layout.desks[0].placement.points = []; },
        (layout: any) => { layout.racks[0].name = 'Sobrescrita'; },
        (layout: any) => { layout.sectors[0].polygon[0].id = 'node'; },
        (layout: any) => { layout.geometry.background = { originalFileId: 'inexistente', renderedFileId: 'cruzado', page: null, sourceWidthPx: 800, sourceHeightPx: 600, placement: { x: 0, y: 0, width: 8, height: 6, rotation: 0 } }; },
      ]) {
        const layout = structuredClone(current.layout); corrupt(layout);
        assert.equal((await save(current.revision, layout)).statusCode, 400);
        assert.deepEqual(await read(), current);
      }
      for (const corrupt of [
        (layout: any) => { layout.geometry.openings[0].wallId = 'ausente'; },
        (layout: any) => { layout.geometry.walls.push(structuredClone(layout.geometry.walls[0])); },
        (layout: any) => { layout.geometry.openings.push(structuredClone(layout.geometry.openings[0])); },
      ]) {
        const layout = structuredClone(current.layout); corrupt(layout);
        assert.equal((await save(current.revision, layout)).statusCode, 400);
        assert.deepEqual(await read(), current);
      }
    });

    await t.test('edição cadastral em curso rejeita o layout sem deadlock nem gravação parcial', async () => {
      const base = await read(), editor = await pool.connect();
      const attempted = structuredClone(base.layout);
      attempted.camera.x += 100;
      attempted.desks[0].placement.x = 100;
      let pending: ReturnType<typeof save> | undefined;
      try {
        await editor.query('BEGIN');
        await editor.query("SET LOCAL deadlock_timeout = '5s'");
        await editor.query('SELECT id FROM desks WHERE id=$1 FOR UPDATE', [desk]);
        pending = save(base.revision, attempted);
        // Dar ao salvamento a oportunidade de adquirir o lock da planta. O teste também
        // aceita a rejeição imediata ao encontrar a mesa bloqueada pelo cadastro.
        const deadline = Date.now() + 3000;
        let response: Awaited<ReturnType<typeof save>> | undefined;
        pending.then(value => { response = value; });
        while (!response && Date.now() < deadline) {
          const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'UPDATE desks SET placement=%'");
          if (waiting.rowCount) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await editor.query('UPDATE desks SET placement=$2 WHERE id=$1', [desk, JSON.stringify({ x: 21, y: 22, width: 1.2, height: 0.6, rotation: 0 })]);
        await editor.query('COMMIT');
        const result = await pending;
        assert.equal(result.statusCode, 409, result.body);
        const after = await read();
        assert.equal(after.revision, base.revision + 1);
        const expected = structuredClone(base.layout);
        expected.desks[0].placement = { x: 21, y: 22, width: 1.2, height: 0.6, rotation: 0 };
        assert.deepEqual(after.layout, expected);
      } finally {
        await editor.query('ROLLBACK');
        if (pending) await pending;
        editor.release();
      }
    });

    await t.test('cadastro alterado após leitura avança revisão e bloqueia snapshot antigo sem tocar conexão', async () => {
      const stale = await read();
      await pool.query('UPDATE desks SET placement=$2 WHERE id=$1', [desk, JSON.stringify({ x: 12, y: 13, width: 1.2, height: 0.6, rotation: 0 })]);
      const rejected = await save(stale.revision, stale.layout); assert.equal(rejected.statusCode, 409, rejected.body);
      const after = await read(); assert.deepEqual(after.layout.desks[0].placement, { x: 12, y: 13, width: 1.2, height: 0.6, rotation: 0 });
      assert.equal((await pool.query('SELECT count(*)::int n FROM connections WHERE id=$1 AND point_id=$2 AND port_id=$3', [connection, point, port])).rows[0]!.n, 1);
    });

    await t.test('membro criado após leitura não é apagado nem omitido por gravação desatualizada', async () => {
      const stale = await read();
      await pool.query("INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,'Setor novo QA',$3)", [company, plan, JSON.stringify([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }])]);
      assert.equal((await save(stale.revision, stale.layout)).statusCode, 409);
      assert.equal((await pool.query('SELECT count(*)::int n FROM sectors WHERE plan_id=$1', [plan])).rows[0]!.n, 2);
    });

    await t.test('objetos removidos entre leitura e gravação não são recriados por snapshot antigo', async () => {
      for (const [table, collection, sql, source] of [
        ['desks', 'desks', "INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Mesa removível QA') RETURNING id", null],
        ['racks', 'racks', "INSERT INTO racks(company_id,unit_id,datacenter_id,plan_id,name,capacity_u) SELECT company_id,unit_id,datacenter_id,$2,'Rack removível QA',24 FROM racks WHERE id=$1 RETURNING id", rack],
        ['sectors', 'sectors', "INSERT INTO sectors(company_id,plan_id,name,polygon) SELECT company_id,$2,'Setor removível QA',polygon FROM sectors WHERE id=$1 RETURNING id", sector],
      ]) {
        const added = (await pool.query(sql!, [source ?? company, plan])).rows[0]!.id;
        const stale = await read();
        assert.ok(stale.layout[collection!].some((item: { id: string }) => item.id === added));
        await pool.query(`DELETE FROM ${table} WHERE id=$1`, [added]);
        const current = await read(); assert.equal(current.revision, stale.revision + 1);
        assert.equal((await save(stale.revision, stale.layout)).statusCode, 409);
        // Mesmo adulterando a revisão, o conjunto de referências antigo é rejeitado.
        assert.equal((await save(current.revision, stale.layout)).statusCode, 409);
        assert.equal((await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [added])).rowCount, 0);
        assert.deepEqual(await read(), current);
      }
    });

    await t.test('alterações de rack, setor e filiação invalidam a leitura anterior', async () => {
      for (const [sql, params] of [
        ['UPDATE racks SET placement=NULL WHERE id=$1', [rack]],
        ['UPDATE sectors SET polygon=$2 WHERE id=$1', [sector, JSON.stringify([{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 0, y: 9 }])]],
        ['UPDATE desks SET sector_id=NULL WHERE id=$1', [desk]],
        ['UPDATE racks SET plan_id=NULL WHERE id=$1', [rack]],
        ['UPDATE racks SET plan_id=$2 WHERE id=$1', [rack, plan]],
      ] as [string, unknown[]][]) {
        const stale = await read(); await pool.query(sql, params);
        const current = await read(); assert.equal(current.revision, stale.revision + 1);
        assert.equal((await save(stale.revision, stale.layout)).statusCode, 409);
        assert.deepEqual(await read(), current);
      }
      const current = await read();
      assert.equal(current.layout.racks[0].placement, null);
      assert.equal((await save(current.revision, current.layout)).statusCode, 200);
    });

    await t.test('visualizador lê e não salva; estrutura geométrica inválida não persiste', async () => {
      const createdUser = (await pool.query("INSERT INTO users(login,name,password_hash) VALUES ('viewer.layout.qa','Viewer QA',$1) RETURNING id", [await hashPassword(viewerPassword)])).rows[0]!.id;
      await pool.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'viewer')", [createdUser, company]);
      const viewerLogin = await app!.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'viewer.layout.qa', password: viewerPassword } });
      assert.equal(viewerLogin.statusCode, 200);
      const viewerCookie = viewerLogin.headers['set-cookie']!.toString().split(';')[0]!;
      assert.equal((await app!.inject({ method: 'GET', url: `/api/companies/${company}/plans/${plan}/layout`, headers: { cookie: viewerCookie } })).statusCode, 200);
      const forbidden = await app!.inject({ method: 'PUT', url: `/api/companies/${company}/plans/${plan}/layout`, headers: { origin, cookie: viewerCookie }, payload: { expectedRevision: 1, layout: {} } });
      assert.equal(forbidden.statusCode, 403);
      const current = await read(), invalid = structuredClone(current.layout); invalid.geometry.walls.push({ id: 'bad', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, thickness: 0 });
      assert.equal((await save(current.revision, invalid)).statusCode, 400);
      assert.equal((await app!.inject({ method: 'GET', url })).statusCode, 401);
      assert.equal((await app!.inject({ method: 'GET', url: `/api/companies/${companyB}/plans/${planB}/layout`, headers: { cookie: viewerCookie } })).statusCode, 404);
      await pool.query("UPDATE company_permissions SET role='manager' WHERE user_id=$1", [createdUser]);
      const asManager = await app!.inject({ method: 'PUT', url, headers: { origin, cookie: viewerCookie }, payload: { expectedRevision: current.revision, layout: current.layout } });
      assert.equal(asManager.statusCode, 200, asManager.body);
      const managed = await read();
      await pool.query("UPDATE company_permissions SET role='viewer' WHERE user_id=$1", [createdUser]);
      assert.equal((await app!.inject({ method: 'PUT', url, headers: { origin, cookie: viewerCookie }, payload: { expectedRevision: managed.revision, layout: managed.layout } })).statusCode, 403);
      assert.deepEqual(await read(), managed);
    });
    await t.test('etapa 12: vínculo explícito de rack protege revisão, unidade, filiação e cabeamento', async () => {
      const newRack = (await pool.query("INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,'Rack sem planta',24) RETURNING id", [company, unit, dc])).rows[0]!.id;
      const cables = [];
      for (const table of ['points', 'equipment', 'ports', 'connections']) cables.push((await pool.query(`SELECT to_jsonb(t) FROM ${table} t ORDER BY id`)).rows);
      const current = await read(), attach = `/api/companies/${company}/plans/${plan}/racks/${newRack}`;
      assert.equal((await call('POST', attach, { expectedRevision: current.revision - 1 })).statusCode, 409);
      const revisionB = Number((await pool.query('SELECT revision FROM plans WHERE id=$1', [planB])).rows[0]!.revision);
      assert.equal((await call('POST', `/api/companies/${companyB}/plans/${planB}/racks/${newRack}`, { expectedRevision: revisionB })).statusCode, 404);
      assert.equal((await call('POST', attach, { expectedRevision: current.revision })).statusCode, 200);
      const after = await read(); assert.equal(after.revision, current.revision + 1);
      assert.deepEqual(after.layout.racks.find((item: { id: string }) => item.id === newRack), { id: newRack, placement: null });
      assert.equal((await call('POST', attach, { expectedRevision: after.revision })).statusCode, 409);
      for (const [index, table] of ['points', 'equipment', 'ports', 'connections'].entries()) assert.deepEqual((await pool.query(`SELECT to_jsonb(t) FROM ${table} t ORDER BY id`)).rows, cables[index]);
      const otherUnit = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Outra unidade') RETURNING id", [company])).rows[0]!.id;
      const otherDc = (await pool.query("INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,'Outro DC') RETURNING id", [company, otherUnit])).rows[0]!.id;
      const otherRack = (await pool.query("INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,'Outro rack',24) RETURNING id", [company, otherUnit, otherDc])).rows[0]!.id;
      assert.equal((await call('POST', `/api/companies/${company}/plans/${plan}/racks/${otherRack}`, { expectedRevision: after.revision })).statusCode, 404);
      const viewer = (await app!.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'viewer.layout.qa', password: viewerPassword } }));
      assert.equal(viewer.statusCode, 200);
      assert.equal((await app!.inject({ method: 'POST', url: attach, headers: { origin, cookie: viewer.headers['set-cookie']!.toString().split(';')[0]! }, payload: { expectedRevision: after.revision } })).statusCode, 403);
    });
  } finally {
    if (app) await app.close();
    await pool.end();
    if (created) { await root.query(`DROP DATABASE "${database}" WITH (FORCE)`); }
    await root.end();
  }
});
