import Fastify from 'fastify';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { databaseConfig } from './database/config.js';

const pool = new pg.Pool({
  ...databaseConfig(),
  max: 5,
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

const app = Fastify({ logger: true });
pool.on('error', () => app.log.warn('Conexão ociosa com PostgreSQL interrompida.'));
await mkdir(process.env.FILES_DIR ?? '/data/files', { recursive: true });

app.get('/api/health', async (_request, reply) => {
  let database: 'up' | 'down' = 'up';
  try {
    await pool.query('SELECT 1');
  } catch {
    database = 'down';
  }
  return reply.code(database === 'up' ? 200 : 503).send({
    status: database === 'up' ? 'ok' : 'degraded',
    service: 'topologia_new',
    database,
    checkedAt: new Date().toISOString(),
  });
});

app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

await app.listen({ host: '0.0.0.0', port: 3001 });
