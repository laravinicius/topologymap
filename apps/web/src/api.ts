export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', signal: options?.signal ?? AbortSignal.timeout(10000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(response.status, body?.message ?? 'Serviço indisponível. Tente novamente.');
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
export const message = (error: unknown) => error instanceof ApiError ? error.message : 'Não foi possível conectar. Tente novamente.';
export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
