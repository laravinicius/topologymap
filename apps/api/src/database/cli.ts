import pg from 'pg';
import { databaseConfig } from './config.js';
import { runMigrations } from './migrations.js';

const argument = process.argv[2] ?? 'apply';
if (argument !== 'apply' && argument !== 'status') throw new Error('Uso: cli.ts apply|status');
const pool = new pg.Pool({ ...databaseConfig(), max: 1 });
try {
  const results = await runMigrations(pool, { statusOnly: argument === 'status' });
  for (const result of results) console.log(`${result.name}: ${result.state}`);
} catch (error) {
  console.error('Migração não concluída:', error instanceof Error ? error.message : 'erro desconhecido');
  process.exitCode = 1;
} finally { await pool.end(); }
