import { publicOrigin } from '@topologia-new/domain';
export interface AuthConfig { origins: string[]; production: boolean; sessionSeconds: number; publicOrigin?: string }
export function authConfig(): AuthConfig {
  const production = process.env.NODE_ENV === 'production';
  const raw = process.env.APP_ORIGINS;
  if (!raw) throw new Error('APP_ORIGINS precisa conter as origens da interface.');
  const origins = raw.split(',').map(value => value.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) {
      throw new Error('APP_ORIGINS deve conter origens completas; produção exige HTTPS.');
    }
  }
  const origin = publicOrigin(process.env.PUBLIC_ORIGIN ?? origins[0]!, production);
  return { origins, production, sessionSeconds: 8 * 60 * 60, publicOrigin: origin };
}
