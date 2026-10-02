import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { SearchResponse, SearchResult } from '@topologia-new/domain';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { searchFixtures } from './search-fixtures.js';

test('etapa 15: busca, contexto canônico e autorização em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test15_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 6 });
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false, cookie = '';
  try {
    assert.notEqual(database, config.database); await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool); await provisionAdmin(pool, { login: 'qa.search', name: 'QA busca', password });
    const userId = (await pool.query("SELECT id FROM users WHERE login='qa.search'")).rows[0].id;
    const h = await searchFixtures(pool);
    await pool.query('UPDATE users SET is_admin=false WHERE id=$1', [userId]);
    await pool.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'manager'),($1,$3,'viewer')", [userId, h.company, h.other]);
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800 });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'qa.search', password } });
    assert.equal(login.statusCode, 200); cookie = login.headers['set-cookie']!.toString().split(';')[0]!;
    const get = (url: string, token = cookie) => app!.inject({ method: 'GET', url, headers: { cookie: token } });
    const search = async (f: Record<string, string> = {}) => {
      const response = await get(`/api/search?${new URLSearchParams(f)}`); assert.equal(response.statusCode, 200, response.body); return response.json<SearchResponse>();
    };
    const locate = async (kind: string, id: string, company = h.company) => {
      const response = await get(`/api/companies/${company}/locate/${kind}/${id}`); assert.equal(response.statusCode, 200, response.body); return response.json<SearchResult>();
    };
    await t.test('busca global e facetas só contêm empresas autorizadas, incluindo visualizador', async () => {
      const all = await search();
      assert.ok(all.results.some(r => r.target.companyId === h.other));
      assert.ok(all.results.every(r => r.target.companyId !== h.denied));
      assert.ok(all.facets.units.every(r => r.companyId !== h.denied));
      assert.equal((await search({ companyId: h.other })).results.length, 2);
      assert.equal((await get('/api/search', '')).statusCode, 401);
    });
    await t.test('nomes atuais, case insensitive, tipos e metacaracteres literais', async () => {
      assert.equal((await search({ q: 'mEsA 01', kind: 'desk' })).total, 2);
      assert.equal((await search({ kind: 'patch_panel' })).total, 3);
      assert.equal((await search({ q: '%' })).total, 0);
      assert.equal((await search({ q: "' OR 1=1 --" })).total, 0);
      await pool.query('UPDATE points SET name=$2 WHERE id=$1', [h.points[7], 'Ponto 50%_\\literal']);
      assert.equal((await search({ q: '50%_\\literal' })).results[0]?.id, h.points[7]);
      await pool.query('UPDATE desks SET name=$2 WHERE id=$1', [h.desk, 'Mesa renomeada']);
      const point = await locate('point', h.points[0]!); assert.match(point.context, /Mesa renomeada/); assert.equal(point.target.deskId, h.desk);
    });
    await t.test('empresa/unidade/andar/setor filtram sem misturar contextos', async () => {
      const floor = await search({ companyId: h.company, unitId: h.unit, floorId: h.floor });
      assert.ok(floor.results.every(r => r.target.floorId === h.floor));
      assert.equal((await search({ companyId: h.company.toUpperCase(), unitId: h.unit.toUpperCase(), floorId: h.floor.toUpperCase() })).total, floor.total);
      const sector = await search({ sectorId: h.sector });
      assert.equal(sector.total, 9); assert.ok(sector.results.every(r => r.target.deskId === h.desk));
      const invalidFilters: Record<string, string>[] = [{ companyId: h.other, unitId: h.unit }, { unitId: h.otherUnit, floorId: h.floor }, { floorId: h.rackFloor, sectorId: h.sector }, { unitId: h.deniedUnit }, { companyId: h.denied }, { sectorId: randomUUID() }];
      for (const filters of invalidFilters) assert.equal((await get(`/api/search?${new URLSearchParams(filters)}`)).statusCode, 404);
    });
    await t.test('dois datacenters com racks de mesmo nome e vínculos em ambos os sentidos', async () => {
      const racks = (await search({ q: 'Rack 01', kind: 'rack' })).results;
      assert.equal(racks.length, 2); assert.deepEqual(new Set(racks.map(r => r.target.datacenterId)), new Set([h.dc1, h.dc2]));
      for (let i = 0; i < 2; i++) {
        const point = (await get(`/api/companies/${h.company}/points/${h.points[i]}/connection`)).json().connection;
        const port = (await get(`/api/companies/${h.company}/ports/${h.ports[i]![0]}/connection`)).json().connection;
        assert.deepEqual(point, port); assert.equal(point.path.destination.datacenter.id, i ? h.dc2 : h.dc1);
        const destination = await locate('port', port.portId), origin = await locate('point', port.pointId);
        assert.equal(destination.target.rackId, i ? h.rack2 : h.rack1); assert.equal(destination.target.planId, i ? h.plan : h.rackPlan);
        assert.equal(origin.target.planId, h.plan); assert.equal(origin.target.floorId, h.floor); assert.equal(origin.target.sectorId, h.sector);
      }
      const inverse = (await get(`/api/companies/${h.company}/ports/${h.ports[1]![1]}/connection`)).json().connection;
      assert.equal((await locate('point', inverse.pointId)).target.planId, h.rackPlan);
      assert.equal((await locate('port', inverse.portId)).target.planId, h.plan);
      const crossed = `/api/companies/${h.company}/units/${h.unit}/datacenters/${h.dc2}/racks/${h.rack1}`;
      assert.equal((await get(crossed)).statusCode, 404);
    });
    await t.test('rack com planta sem posição e rack sem planta são consultáveis com patch panel e portas', async () => {
      const unplaced = await locate('rack', h.rack2), orphan = await locate('port', h.ports[2]![0]!);
      assert.equal(unplaced.positioned, false); assert.equal(unplaced.target.planId, h.plan);
      assert.equal(orphan.positioned, false); assert.equal(orphan.target.planId, null); assert.equal(orphan.target.datacenterId, h.dc2);
      assert.equal((await get(`/api/companies/${h.company}/units/${h.unit}/datacenters/${h.dc2}/racks/${h.orphanRack}/equipment/${h.panels[2]}`)).statusCode, 200);
    });
    await t.test('paginação estável retorna todos os resultados, sem duplicação e total fora da página', async () => {
      for (let n = 0; n < 65; n++) await pool.query('INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,$3)', [h.company, h.plan, `Escala ${String(n).padStart(2, '0')}`]);
      const first = await search({ q: 'Escala' }), next = await search({ q: 'Escala', offset: '50' }), empty = await search({ q: 'Escala', offset: '100' });
      assert.equal(first.total, 65); assert.equal(first.results.length, 50); assert.equal(next.results.length, 15); assert.equal(empty.total, 65); assert.equal(empty.results.length, 0);
      assert.equal(new Set([...first.results, ...next.results].map(r => r.id)).size, 65);
    });
    await t.test('URLs diretas protegem empresa/IDs cruzados e entradas inválidas', async () => {
      for (const [company, kind, id] of [[h.company, 'rack', h.otherRack], [h.denied, 'datacenter', h.deniedDc], [h.company, 'port', h.rack1], [h.company, 'point', randomUUID()]])
        assert.equal((await get(`/api/companies/${company}/locate/${kind}/${id}`)).statusCode, 404);
      for (const query of ['kind=equipment', 'q=' + 'x'.repeat(201), 'offset=-1', 'offset=1.5', 'unitId=invalid', 'extra=field'])
        assert.equal((await get(`/api/search?${query}`)).statusCode, 400);
      const url = `/api/companies/${h.other}/units/${h.otherUnit}/datacenters/${h.otherDc}/racks/${h.otherRack}`;
      assert.equal((await app!.inject({ method: 'PATCH', url, headers: { cookie, origin }, payload: { name: 'Negado' } })).statusCode, 403);
    });
    await t.test('revogação/desativação com sessão existente remove resultados e bloqueia resolução', async () => {
      await pool.query('DELETE FROM company_permissions WHERE user_id=$1 AND company_id=$2', [userId, h.company]);
      assert.ok((await search()).results.every(r => r.target.companyId === h.other));
      assert.equal((await get(`/api/companies/${h.company}/locate/desk/${h.desk}`)).statusCode, 404);
      await pool.query('UPDATE users SET is_active=false WHERE id=$1', [userId]);
      assert.equal((await get('/api/search')).statusCode, 401);
      assert.equal((await get(`/api/companies/${h.other}/locate/rack/${h.otherRack}`)).statusCode, 401);
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await root.end();
  }
});
