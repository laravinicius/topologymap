import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import type { InjectOptions } from 'fastify';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { buildApp } from '../src/app.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { authConfig } from '../src/auth/config.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

test('etapa 03: autenticação com PostgreSQL isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig();
  const name = `topologia_new_test03_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({ ...config, max: 1 });
  const pool = new pg.Pool({ ...config, database: name, max: 5 });
  const origin = 'http://localhost:5173';
  const settings = { origins: [origin], production: false, sessionSeconds: 28800 };
  const password = randomBytes(24).toString('base64url');
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let created = false;
  try {
    assert.notEqual(name, config.database);
    await root.query(`CREATE DATABASE "${name}"`); created = true;
    await runMigrations(pool);
    await t.test('hash forte com salts diferentes; senha incorreta não autentica', async () => {
      const first = await hashPassword(password), second = await hashPassword(password);
      assert.notEqual(first, second);
      assert.match(first, /^scrypt\$131072\$8\$1\$/);
      assert.equal(await verifyPassword(password, first), true);
      assert.equal(await verifyPassword(randomBytes(20).toString('hex'), first), false);
    });
    await t.test('provisionamento concorrente cria exatamente um administrador; repetição não troca senha', async () => {
      const outcomes = await Promise.allSettled([
        provisionAdmin(pool, { login: 'synthetic', name: 'Administrador sintético', password }),
        provisionAdmin(pool, { login: 'synthetic', name: 'Outro sintético', password }),
      ]);
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      const before = (await pool.query('SELECT * FROM users')).rows;
      assert.equal(before.length, 1);
      await assert.rejects(provisionAdmin(pool, { login: 'different', name: 'Outro', password: randomBytes(24).toString('hex') }), /Já existe administrador/);
      assert.deepEqual((await pool.query('SELECT * FROM users')).rows, before);
      await pool.query('UPDATE users SET is_active=false');
      await assert.rejects(provisionAdmin(pool, { login: 'different', name: 'Outro', password }), /Já existe administrador/);
      await pool.query('UPDATE users SET is_active=true');
      await assert.rejects(provisionAdmin(pool, { login: 'invalid space', name: 'Outro', password }), /Login/);
      await assert.rejects(provisionAdmin(pool, { login: 'valid', name: 'Outro', password: '' }), /Senha/);
    });
    app = await buildApp(pool, settings);
    const inject = (options: InjectOptions) => app!.inject(options);
    const login = () => inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: ' SYNTHETIC ', password } });
    const resetLimits = () => pool.query('DELETE FROM login_limits');
    const get = (url: string, cookie?: string) => inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
    let cookie = '', tokenHash = '';

    await t.test('sem sessão: sessão/parque/rotas futuras bloqueados; healthcheck público', async () => {
      for (const url of ['/api/auth/session', '/api/park', '/api/companies']) {
        assert.equal((await get(url)).statusCode, 401);
      }
      assert.equal((await get('/api/health')).statusCode, 200);
      assert.equal((await get('/api/park', 'topologia_session=malformed')).statusCode, 401);
    });
    await t.test('escritas rejeitam origem ausente, diferente, null e Fetch Metadata cross-site antes de criar sessão', async () => {
      for (const headers of [{}, { origin: 'https://other.invalid' }, { origin: 'null' }, { origin, 'sec-fetch-site': 'cross-site' }]) {
        for (const url of ['/api/auth/login', '/api/auth/logout', '/api/future-write']) {
          assert.equal((await inject({ method: 'POST', url, headers, payload: { login: 'synthetic', password } })).statusCode, 403);
        }
      }
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n, 0);
    });
    await t.test('login incorreto e conta inexistente têm resposta genérica igual; validações não ecoam credenciais', async () => {
      const wrong = randomBytes(20).toString('hex');
      const a = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'synthetic', password: wrong } });
      const b = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'missing', password: wrong } });
      assert.equal(a.statusCode, 401); assert.equal(b.statusCode, 401); assert.deepEqual(a.json(), b.json());
      assert.equal(a.body.includes(wrong), false);
      const invalid = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { password } });
      assert.equal(invalid.statusCode, 400); assert.equal(invalid.body.includes(password), false);
      const huge = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { login: 'synthetic', password: 'x'.repeat(5000) } });
      assert.equal(huge.statusCode, 413);
      await resetLimits();
    });
    await t.test('login cria sessão de 8 horas; só hash no banco; cookie HttpOnly/SameSite/Path e resposta pública', async () => {
      const response = await login();
      assert.equal(response.statusCode, 200);
      const header = response.headers['set-cookie'] as string;
      assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /Path=\//); assert.match(header, /Max-Age=28800/);
      assert.doesNotMatch(header, /Secure|Domain=/);
      cookie = header.split(';')[0]!;
      const token = cookie.split('=')[1]!;
      tokenHash = createHash('sha256').update(token).digest('hex');
      const stored = (await pool.query('SELECT * FROM sessions WHERE token_hash=$1', [tokenHash])).rows[0];
      assert.ok(stored); assert.notEqual(stored.token_hash, token);
      assert.ok(Math.abs((stored.expires_at-stored.created_at)/1000-28800) < 2);
      assert.deepEqual(Object.keys(response.json()).sort(), ['expiresAt', 'user']);
      assert.deepEqual(Object.keys(response.json().user).sort(), ['id', 'isAdmin', 'login', 'name']);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal((await get('/api/park', cookie)).statusCode, 200);
      assert.equal((await get('/api/auth/session', cookie)).json().user.login, 'synthetic');
    });
    await t.test('sessão permanece depois de reconstruir API (sem memória de autenticação)', async () => {
      await app!.close(); app = await buildApp(pool, settings);
      assert.equal((await get('/api/auth/session', cookie)).statusCode, 200);
    });
    await t.test('logout de outra origem não revoga; logout válido invalida token antigo e limpa cookie', async () => {
      assert.equal((await inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: 'https://other.invalid', cookie } })).statusCode, 403);
      assert.equal((await get('/api/auth/session', cookie)).statusCode, 200);
      const response = await inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie } });
      assert.equal(response.statusCode, 204); assert.match(response.headers['set-cookie'] as string, /Expires=Thu, 01 Jan 1970/);
      assert.ok((await pool.query('SELECT revoked_at FROM sessions WHERE token_hash=$1', [tokenHash])).rows[0].revoked_at);
      assert.equal((await get('/api/park', cookie)).statusCode, 401);
      assert.equal((await inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie } })).statusCode, 204);
    });
    await t.test('novo login gira cookie e revoga sessão anterior (sem fixação de sessão)', async () => {
      await resetLimits();
      cookie = ((await login()).headers['set-cookie'] as string).split(';')[0]!;
      const rotated = await inject({ method: 'POST', url: '/api/auth/login', headers: { origin, cookie }, payload: { login: 'synthetic', password } });
      const next = (rotated.headers['set-cookie'] as string).split(';')[0]!;
      assert.notEqual(next, cookie);
      assert.equal((await get('/api/auth/session', cookie)).statusCode, 401);
      cookie = next;
    });
    await t.test('expiração é verificada pelo relógio do banco, mesmo reenviando cookie', async () => {
      await pool.query("UPDATE sessions SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE revoked_at IS NULL");
      const expired = await get('/api/auth/session', cookie);
      assert.equal(expired.statusCode, 401);
      assert.match(expired.headers['set-cookie'] as string, /Expires=Thu, 01 Jan 1970/);
      assert.equal((await get('/api/park', cookie)).statusCode, 401);
    });
    await t.test('usuário desativado perde acesso na próxima consulta e não entra novamente', async () => {
      await resetLimits(); cookie = ((await login()).headers['set-cookie'] as string).split(';')[0]!;
      await pool.query('UPDATE users SET is_active=false');
      assert.equal((await get('/api/auth/session', cookie)).statusCode, 401);
      assert.equal((await login()).statusCode, 401);
      await pool.query('UPDATE users SET is_active=true');
    });
    await t.test('limite por login: cinco tentativas em 15 minutos, persistência após reinício e liberação após janela', async () => {
      await resetLimits();
      for (let i = 0; i < 5; i++) assert.equal((await login()).statusCode, 200);
      let blocked = await login(); assert.equal(blocked.statusCode, 429); assert.ok(Number(blocked.headers['retry-after']) > 0);
      await app!.close(); app = await buildApp(pool, settings);
      blocked = await login(); assert.equal(blocked.statusCode, 429);
      await pool.query("UPDATE login_limits SET resets_at=clock_timestamp()-interval '1 second'");
      assert.equal((await login()).statusCode, 200);
      assert.equal((await pool.query("SELECT attempts FROM login_limits WHERE key LIKE 'login:%'")).rows[0].attempts, 1);
    });
    await t.test('limite por IP: 20 tentativas, X-Forwarded-For não contorna; janela concorrente é atômica', async () => {
      await resetLimits();
      // Entradas inválidas contam por IP antes da validação e não gastam scrypt.
      for (let i = 0; i < 19; i++) assert.equal((await inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: {} })).statusCode, 400);
      const responses = await Promise.all(Array.from({ length: 4 }, (_, i) => inject({ method: 'POST', url: '/api/auth/login', headers: { origin, 'x-forwarded-for': `192.0.2.${i}` }, payload: {} })));
      assert.equal(responses.filter(x => x.statusCode === 400).length, 1);
      assert.equal(responses.filter(x => x.statusCode === 429).length, 3);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM login_limits WHERE key LIKE 'ip:%'")).rows[0].n, 1);
      await resetLimits();
    });
    await t.test('produção emite __Host cookie Secure; configuração recusa origem HTTP em produção', async () => {
      const secure = await buildApp(pool, { ...settings, origins: ['https://app.example.invalid'], production: true });
      try {
        const response = await secure.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://app.example.invalid' }, payload: { login: 'synthetic', password } });
        assert.equal(response.statusCode, 200);
        const header = response.headers['set-cookie'] as string;
        assert.match(header, /^__Host-topologia_session=/); assert.match(header, /Secure/); assert.match(header, /HttpOnly/); assert.doesNotMatch(header, /Domain=/);
      } finally { await secure.close(); }
      const env = { NODE_ENV: process.env.NODE_ENV, APP_ORIGINS: process.env.APP_ORIGINS };
      try {
        process.env.NODE_ENV = 'production'; process.env.APP_ORIGINS = origin;
        assert.throws(authConfig, /HTTPS/);
        delete process.env.APP_ORIGINS; assert.throws(authConfig, /APP_ORIGINS/);
        process.env.APP_ORIGINS = 'https://app.example.invalid'; assert.equal(authConfig().production, true);
      } finally {
        for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      }
    });
  } finally {
    await app?.close(); await pool.end();
    if (created) await root.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await root.end();
  }
});
