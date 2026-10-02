/** Contrato público deliberadamente sem IDs, filiação, posição ou metadados internos. */
export interface PublicDesk {
  name: string;
  points: { name: string; destination: { datacenter: string; rack: string; patchPanel: string; port: string } | null }[];
}
export interface DeskPublicLink {
  enabled: boolean;
  token: string | null;
  revision: number;
  origin: string;
}
export type PublicLinkAction = 'activate' | 'deactivate' | 'renew';
export const publicTokenPattern = /^[a-f0-9]{64}$/;
export function publicOrigin(value: string, production = false): string {
  const url = new URL(value);
  if (url.origin !== value || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:'))
    throw new Error('A origem pública deve ser uma origem HTTP/HTTPS completa, sem caminho. Produção exige HTTPS.');
  return url.origin;
}
export function publicDeskUrl(origin: string, token: string): string {
  if (!publicTokenPattern.test(token)) throw new Error('Identificador público inválido.');
  return `${publicOrigin(origin)}/mesa/${token}`;
}
