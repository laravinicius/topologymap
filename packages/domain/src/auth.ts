/** Respostas públicas de autenticação; nunca incluem hashes ou tokens. */
export interface AuthUser { id: string; login: string; name: string; isAdmin: boolean }
export interface AuthSession { user: AuthUser; expiresAt: string }
export interface LoginInput { login: string; password: string }
