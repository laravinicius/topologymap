import { createInterface, emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import pg from 'pg';
import { databaseConfig } from '../database/config.js';
import { provisionAdmin } from './provision.js';

async function question(label: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return await new Promise(resolve => rl.question(label, resolve)); }
  finally { rl.close(); }
}
async function password(label: string): Promise<string> {
  stdout.write(label);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (cancelled: boolean) => {
      stdin.removeListener('keypress', listener);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (cancelled) reject(new Error('Provisionamento cancelado.'));
      else resolve(value);
    };
    const listener = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') return finish(true);
      if (key.name === 'return' || key.name === 'enter') return finish(false);
      if (key.name === 'backspace') { value = Array.from(value).slice(0, -1).join(''); return; }
      if (!key.ctrl && text && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    };
    stdin.on('keypress', listener);
  });
}

let pool: pg.Pool | undefined;
try {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Use terminal interativo: npm run admin:create (sem -T).');
  pool = new pg.Pool({ ...databaseConfig(), max: 1 });
  if ((await pool.query('SELECT 1 FROM users WHERE is_admin LIMIT 1')).rowCount) {
    throw new Error('Já existe administrador. Nenhuma conta ou senha foi alterada.');
  }
  const name = await question('Nome do administrador: ');
  const login = await question('Login do administrador: ');
  const secret = await password('Senha (12 a 128 caracteres; entrada oculta): ');
  if (secret !== await password('Confirme a senha (entrada oculta): ')) throw new Error('As senhas não coincidem.');
  await provisionAdmin(pool, { name, login, password: secret });
  stdout.write('Administrador criado. Entre pela tela de login.\n');
} catch (error) {
  // Erros de banco nunca incluem parâmetros/credenciais no terminal.
  const message = error instanceof Error && !('code' in error) ? error.message : 'Falha no banco. Confira se as migrações foram aplicadas.';
  console.error(message);
  process.exitCode = 1;
} finally { await pool?.end(); }
