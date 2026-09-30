/** Ambiente opcional de QA: banco exclusivo, sem seeds no banco de trabalho. */
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { buildApp } from '../src/app.js';
import { provisionAdmin } from '../src/auth/provision.js';

const config = databaseConfig();
const stage04 = process.argv.includes('--stage04');
const stage05 = process.argv.includes('--stage05');
const database = `topologia_new_test${stage05 ? '05' : stage04 ? '04' : '03'}_browser_${randomBytes(6).toString('hex')}`;
const root = new pg.Pool({ ...config, max: 1 });
const pool = new pg.Pool({ ...config, database, max: 5 });
const runtime = fileURLToPath(new URL('../../../output/playwright/runtime.json', import.meta.url));
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
let created = false, stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await app?.close(); await pool.end();
  if (created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await root.end(); await rm(runtime, { force: true });
  process.stdin.pause();
}
try {
  if (database === config.database) throw new Error('Banco de QA precisa ser independente.');
  await root.query(`CREATE DATABASE "${database}"`); created = true;
  await runMigrations(pool);
  const credential = { database, login: 'qa.synthetic', password: randomBytes(24).toString('base64url'), pid: process.pid };
  // Provisionamento sintético só por opção explícita no servidor de QA separado.
  if (stage04 || stage05) await provisionAdmin(pool, { ...credential, name: 'Administrador sintético QA' });
  app = await buildApp(pool, { origins: ['http://localhost:5174'], production: false, sessionSeconds: 28800 });
  await mkdir(fileURLToPath(new URL('../../../output/playwright/', import.meta.url)), { recursive: true });
  await writeFile(runtime, JSON.stringify(credential), { mode: 0o600 });
  await app.listen({ host: '0.0.0.0', port: 3002 });
  console.log(`QA isolado pronto em api:3002; banco ${database}; credencial temporária no arquivo ignorado output/playwright/runtime.json. ${stage04 || stage05 ? 'Administrador sintético provisionado por opção explícita.' : 'Nenhum administrador criado.'}`);
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
  process.stdin.resume();
  process.stdin.once('data', () => { void stop(); });
} catch {
  console.error('Falha ao iniciar QA isolado.'); process.exitCode = 1;
  await stop();
}
