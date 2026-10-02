import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { InjectOptions } from 'fastify';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { searchFixtures } from './search-fixtures.js';

test('etapa 16: consulta pública restrita e gestão em PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test16_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 }), pool = new pg.Pool({ ...config, database, max: 6 });
  const password = randomBytes(24).toString('hex'), origin = 'http://localhost:5173';
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false, cookie = '';
  try {
    assert.notEqual(database, config.database); await root.query(`CREATE DATABASE "${database}"`); created = true;
    await runMigrations(pool); await provisionAdmin(pool, { login: 'qa.public', name: 'QA público', password });
    const user = (await pool.query("SELECT id FROM users WHERE login='qa.public'")).rows[0].id;
    const h = await searchFixtures(pool);
    app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800, publicOrigin: 'https://consulta.example.test' });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'qa.public', password } });
    assert.equal(login.statusCode, 200); cookie = login.headers['set-cookie']!.toString().split(';')[0]!;
    const desk = `/api/companies/${h.company}/units/${h.unit}/floors/${h.floor}/plans/${h.plan}/desks/${h.desk}`;
    const manage = `${desk}/public-link`;
    const call = (url: string, method: InjectOptions['method'] = 'GET', payload?: InjectOptions['payload'], authenticated = true) =>
      app!.inject({ method, url, payload, headers: authenticated ? { cookie, origin } : {} });
    const published = (token: string) => call(`/api/public/desks/${token}`, 'GET', undefined, false);
    let token = '', revision = 0;
    await t.test('leitura privada não cria token; admin ativa explicitamente; origem configurada', async () => {
      const before = await call(manage); assert.equal(before.statusCode, 200);
      assert.deepEqual(before.json(), { enabled: false, token: null, revision: 0, origin: 'https://consulta.example.test' });
      assert.equal((await pool.query('SELECT count(*)::int n FROM desk_public_links')).rows[0].n, 0);
      const result = await call(manage, 'PUT', { action: 'activate', expectedRevision: 0 }); assert.equal(result.statusCode, 200, result.body);
      token = result.json().token; revision = result.json().revision; assert.match(token, /^[a-f0-9]{64}$/); assert.notEqual(token, h.desk);
      assert.equal((await call(manage, 'PUT', { action: 'activate', expectedRevision: 0 })).statusCode, 409);
    });
    await t.test('sem cookie: somente nome/pontos/destinos, resposta sem IDs/metadados e sem cache', async () => {
      const response = await published(token); assert.equal(response.statusCode, 200);
      const data = response.json(); assert.deepEqual(Object.keys(data).sort(), ['name', 'points']); assert.equal(data.points.length, 8);
      assert.deepEqual(data.points[0], { name: 'Ponto 1', destination: { datacenter: 'Datacenter 01', rack: 'Rack 01', patchPanel: 'Patch panel 01', port: 'Porta 1' } });
      assert.deepEqual(data.points[2], { name: 'Ponto 3', destination: null });
      for (const point of data.points) assert.deepEqual(Object.keys(point).sort(), ['destination', 'name']);
      assert.ok(!/company|placement|revision|createdAt|sector|password|token|id"/.test(response.body));
      assert.equal(response.headers['cache-control'], 'no-store'); assert.equal(response.headers['referrer-policy'], 'no-referrer');
      assert.equal(response.headers['set-cookie'], undefined);
      const head = await call(`/api/public/desks/${token}`, 'HEAD', undefined, false); assert.equal(head.statusCode, 200); assert.equal(head.body, '');
      // Cookie inválido não impede a consulta nem inicia fluxo de sessão.
      assert.equal((await app!.inject({ url: `/api/public/desks/${token}`, headers: { cookie: 'topologia_session=inválido' } })).statusCode, 200);
    });
    await t.test('token não concede API interna, arquivos, listagens ou escritas públicas', async () => {
      for (const url of [desk, manage, '/api/search', `/api/companies/${h.company}/park`, `/api/companies/${h.company}/plans/${h.plan}/layout`, `/api/companies/${h.company}/plans/${h.plan}/files/${randomUUID()}`])
        assert.equal((await call(`${url}?token=${token}`, 'GET', undefined, false)).statusCode, 401);
      assert.equal((await call(`/api/public/desks/${token}`, 'PUT', { name: 'não' }, false)).statusCode, 403);
      assert.equal((await call(manage, 'PUT', { action: 'activate', expectedRevision: revision }, false)).statusCode, 403);
      const absent = await published(randomBytes(32).toString('hex'));
      for (const invalid of ['invalid', h.desk, 'x'.repeat(64), token.toUpperCase(), "' OR 1=1 --"])
        assert.equal((await published(encodeURIComponent(invalid))).body, absent.body);
      assert.equal(absent.statusCode, 404);
    });
    await t.test('endereço permanece após renomear, mover posição/setor e trocar conexão; conteúdo é atual', async () => {
      assert.equal((await call(desk, 'PATCH', { name: 'Mesa atual', placement: { x: 8, y: 9, width: 1.2, height: .6, rotation: 90 } })).statusCode, 200);
      await pool.query('UPDATE desks SET sector_id=NULL,plan_id=$2 WHERE id=$1', [h.desk, h.rackPlan]);
      await pool.query('UPDATE points SET name=$2 WHERE id=$1', [h.points[0], 'Ponto atual']);
      await pool.query('UPDATE connections SET port_id=$2 WHERE id=$1', [h.connections[0], h.ports[2]![3]]);
      await pool.query('UPDATE racks SET name=$2 WHERE id=$1', [h.orphanRack, 'Rack atual']);
      const data = (await published(token)).json(); assert.equal(data.name, 'Mesa atual'); assert.equal(data.points[0].name, 'Ponto atual');
      assert.deepEqual(data.points[0].destination, { datacenter: 'Datacenter 02', rack: 'Rack atual', patchPanel: 'Patch panel 01', port: 'Porta 4' });
      assert.equal((await pool.query('SELECT token FROM desk_public_links WHERE desk_id=$1', [h.desk])).rows[0].token, token);
      await pool.query('UPDATE desks SET plan_id=$2 WHERE id=$1', [h.desk, h.plan]);
    });
    await t.test('viewer não consulta gestão nem cria/desativa/renova; gerente autorizado opera; IDs cruzados negados', async () => {
      await pool.query('UPDATE users SET is_admin=false WHERE id=$1', [user]);
      await pool.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'viewer')", [user, h.company]);
      assert.equal((await call(manage)).statusCode, 403);
      for (const action of ['activate', 'deactivate', 'renew']) assert.equal((await call(manage, 'PUT', { action, expectedRevision: revision })).statusCode, 403);
      assert.equal((await pool.query('SELECT revision FROM desk_public_links WHERE desk_id=$1', [h.desk])).rows[0].revision, String(revision));
      await pool.query("UPDATE company_permissions SET role='manager' WHERE user_id=$1", [user]);
      assert.equal((await call(manage)).statusCode, 200);
      assert.equal((await call(manage.replace(h.desk, h.deskTwo))).statusCode, 404);
      assert.equal((await call(manage.replace(h.company, h.other))).statusCode, 404);
      for (const payload of [{ action: 'renew', expectedRevision: revision, token: 'chosen' }, { action: 'renew' }, { action: 'erase', expectedRevision: revision }])
        assert.equal((await call(manage, 'PUT', payload)).statusCode, 400);
    });
    await t.test('desativação bloqueia; reativação mantém URL; renovação invalida anterior definitivamente', async () => {
      const disabled = await call(manage, 'PUT', { action: 'deactivate', expectedRevision: revision }); assert.equal(disabled.statusCode, 200);
      revision = disabled.json().revision; assert.equal(disabled.json().token, token); assert.equal((await published(token)).statusCode, 404);
      const active = await call(manage, 'PUT', { action: 'activate', expectedRevision: revision }); assert.equal(active.statusCode, 200);
      revision = active.json().revision; assert.equal(active.json().token, token); assert.equal((await published(token)).statusCode, 200);
      const renewed = await call(manage, 'PUT', { action: 'renew', expectedRevision: revision }); assert.equal(renewed.statusCode, 200);
      const old = token; token = renewed.json().token; revision = renewed.json().revision;
      assert.notEqual(token, old); assert.equal((await published(old)).statusCode, 404); assert.equal((await published(token)).statusCode, 200);
      const disable = (await call(manage, 'PUT', { action: 'deactivate', expectedRevision: revision })).json();
      const renewDisabled = (await call(manage, 'PUT', { action: 'renew', expectedRevision: disable.revision })).json();
      assert.equal(renewDisabled.enabled, false); assert.equal((await published(renewDisabled.token)).statusCode, 404);
      token = renewDisabled.token; revision = renewDisabled.revision;
    });
    await t.test('duas renovações concorrentes: somente uma grava e outra recebe conflito', async () => {
      const responses = await Promise.all([0, 1].map(() => call(manage, 'PUT', { action: 'renew', expectedRevision: revision })));
      assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 409]);
      assert.equal((await published(token)).statusCode, 404);
      const current = (await call(manage)).json(); revision = current.revision; token = current.token;
    });
    await t.test('reiniciar API preserva endereço/estado/revisão e sessão de gestão', async () => {
      await app!.close();
      app = await buildApp(pool, { origins: [origin], production: false, sessionSeconds: 28800, publicOrigin: 'https://consulta.example.test' });
      assert.equal((await call(manage)).statusCode, 200);
      assert.equal((await call(manage)).json().token, token);
      assert.equal((await call(manage)).json().revision, revision);
      assert.equal((await published(token)).statusCode, 404); // Renovação de endereço desativado mantém o estado.
    });
    await t.test('revogação/usuário inativo bloqueiam gestão na sessão existente', async () => {
      await pool.query('DELETE FROM company_permissions WHERE user_id=$1', [user]);
      assert.equal((await call(manage)).statusCode, 404); assert.equal((await call(manage, 'PUT', { action: 'renew', expectedRevision: revision })).statusCode, 404);
      await pool.query('UPDATE users SET is_active=false WHERE id=$1', [user]);
      assert.equal((await call(manage)).statusCode, 401);
    });
    await t.test('FK por empresa e unicidade protegem endereço; excluir mesa remove apenas seu endereço', async () => {
      await assert.rejects(pool.query('INSERT INTO desk_public_links(company_id,desk_id,token) VALUES ($1,$2,$3)', [h.other, h.deskTwo, randomBytes(32).toString('hex')]), e => (e as { code: string }).code === '23503');
      await assert.rejects(pool.query('INSERT INTO desk_public_links(company_id,desk_id,token) VALUES ($1,$2,$3)', [h.company, h.deskTwo, token]), e => (e as { code: string }).code === '23505');
      await pool.query('DELETE FROM connections WHERE point_id=ANY($1::uuid[])', [h.points]);
      await pool.query('DELETE FROM points WHERE desk_id=$1', [h.desk]); await pool.query('DELETE FROM desks WHERE id=$1', [h.desk]);
      assert.equal((await pool.query('SELECT count(*)::int n FROM desk_public_links')).rows[0].n, 0);
      assert.equal((await published(token)).statusCode, 404);
    });
  } finally {
    await app?.close(); await pool.end(); if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`); await root.end();
  }
});
