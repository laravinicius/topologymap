import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt N=2^17/r=8/p=1, salt de 128 bits e chave de 256 bits.
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$131072$8$1$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored);
  if (!match) return false;
  const key = await derive(password, Buffer.from(match[1]!, 'hex'));
  return timingSafeEqual(key, Buffer.from(match[2]!, 'hex'));
}
export function normalizeLogin(login: string): string { return login.trim().toLowerCase(); }
export function validLogin(login: string): boolean { return /^[a-z0-9._@+\-]{1,100}$/.test(login); }
export function validPassword(password: string): boolean { return password.length >= 12 && password.length <= 128; }
