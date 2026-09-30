import type { PoolConfig } from 'pg';

export function databaseConfig(): PoolConfig {
  const password = process.env.DATABASE_PASSWORD;
  if (!password) throw new Error('DATABASE_PASSWORD precisa ser configurada.');
  return {
    host: process.env.DATABASE_HOST ?? 'db',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'topologia_new',
    user: process.env.DATABASE_USER ?? 'topologia_new',
    password, connectionTimeoutMillis: 5000,
  };
}
