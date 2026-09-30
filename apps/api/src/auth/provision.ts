import type pg from 'pg';
import { hashPassword, normalizeLogin, validLogin, validPassword } from './password.js';

export async function provisionAdmin(pool: pg.Pool, input: { login: string; name: string; password: string }): Promise<void> {
  const login = normalizeLogin(input.login), name = input.name.trim();
  if (!validLogin(login)) throw new Error('Login deve ter de 1 a 100 caracteres: letras sem acentos, números e . _ @ + -');
  if (!name || name.length > 200) throw new Error('Nome deve ter de 1 a 200 caracteres.');
  if (!validPassword(input.password)) throw new Error('Senha deve ter de 12 a 128 caracteres.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa somente o bootstrap, inclusive entre dois processos do CLI.
    await client.query('SELECT pg_advisory_xact_lock(303, 1)');
    if ((await client.query('SELECT 1 FROM users WHERE is_admin LIMIT 1')).rowCount) {
      throw new Error('Já existe administrador. Nenhuma conta ou senha foi alterada.');
    }
    if ((await client.query('SELECT 1 FROM users WHERE lower(login)=$1', [login])).rowCount) {
      throw new Error('Login já cadastrado. Nenhuma conta ou senha foi alterada.');
    }
    const hash = await hashPassword(input.password);
    await client.query('INSERT INTO users(login,name,password_hash,is_admin) VALUES ($1,$2,$3,true)', [login, name, hash]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
