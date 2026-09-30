import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { databaseConfig } from './database/config.js';
import { buildApp } from './app.js';
import { authConfig } from './auth/config.js';

const pool = new pg.Pool({
  ...databaseConfig(),
  max: 5,
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
});

const app = await buildApp(pool, authConfig(), true);
pool.on('error', () => app.log.warn('Conexão ociosa com PostgreSQL interrompida.'));
await mkdir(process.env.FILES_DIR ?? '/data/files', { recursive: true });

app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

await app.listen({ host: '0.0.0.0', port: 3001 });
