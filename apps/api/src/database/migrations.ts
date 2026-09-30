import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';

export const migrationsDirectory = fileURLToPath(new URL('../../../../database/migrations/', import.meta.url));
const lock = [20964321, 2] as const;
interface Migration { version: number; name: string; checksum: string; sql: string }
interface Applied { version: number; name: string; checksum: string }
export interface MigrationStatus { version: number; name: string; state: 'applied' | 'pending' }

async function readMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (names.length === 0) throw new Error('Nenhuma migração SQL encontrada.');
  const migrations: Migration[] = [];
  for (const [index, name] of names.entries()) {
    const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match || Number(match[1]) !== index + 1) throw new Error(`Sequência de migrações inválida: ${name}`);
    const sql = await readFile(join(directory, name), 'utf8');
    migrations.push({ version: index + 1, name, sql, checksum: createHash('sha256').update(sql).digest('hex') });
  }
  return migrations;
}

async function history(client: PoolClient): Promise<Applied[]> {
  const exists = await client.query<{ present: boolean }>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
  if (!exists.rows[0]?.present) return [];
  return (await client.query<Applied>('SELECT version, name, checksum FROM public.schema_migrations ORDER BY version')).rows;
}

function validateHistory(migrations: Migration[], applied: Applied[]): void {
  for (const [index, item] of applied.entries()) {
    const file = migrations[index];
    if (!file || file.version !== item.version || file.name !== item.name || file.checksum !== item.checksum) {
      throw new Error(`Histórico divergente na migração ${item.version}: restaure o arquivo aplicado; evolua com um novo arquivo.`);
    }
  }
}

/** Mesmo cliente para lock/transação/SQL/histórico. Sem reset, down ou seeds automáticos. */
export async function runMigrations(pool: Pool, options: { directory?: string; statusOnly?: boolean } = {}): Promise<MigrationStatus[]> {
  const migrations = await readMigrations(options.directory ?? migrationsDirectory);
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SET search_path TO public; SET lock_timeout TO '15s'; SET statement_timeout TO '60s'");
    await client.query('SELECT pg_advisory_lock($1, $2)', [...lock]);
    locked = true;
    const applied = await history(client);
    validateHistory(migrations, applied);
    if (options.statusOnly) return migrations.map(m => ({ version: m.version, name: m.name, state: m.version <= applied.length ? 'applied' : 'pending' }));
    for (const migration of migrations.slice(applied.length)) {
      await client.query('BEGIN');
      try {
        await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
          version integer PRIMARY KEY CHECK (version > 0), name text NOT NULL UNIQUE,
          checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'), applied_at timestamptz NOT NULL DEFAULT now()
        )`);
        await client.query(migration.sql);
        await client.query('INSERT INTO public.schema_migrations(version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return migrations.map(m => ({ version: m.version, name: m.name, state: 'applied' }));
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [...lock]);
      await client.query('RESET search_path; RESET lock_timeout; RESET statement_timeout');
      client.release();
    } catch (error) { client.release(true); throw error; }
  }
}
