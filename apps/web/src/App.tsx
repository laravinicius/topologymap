import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthSession } from '@topologia-new/domain';
import { HealthPanel } from './HealthPanel';

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(response.status, body?.message ?? 'Serviço indisponível. Tente novamente.');
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
const message = (error: unknown) => error instanceof ApiError ? error.message : 'Não foi possível conectar. Tente novamente.';

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [park, setPark] = useState('');
  const authEpoch = useRef(0);
  const authAction = useRef(false);
  const checkNumber = useRef(0);

  const checkSession = useCallback(async () => {
    if (authAction.current) return;
    const epoch = authEpoch.current, number = ++checkNumber.current;
    const current = () => epoch === authEpoch.current && number === checkNumber.current;
    try {
      const result = await api<AuthSession>('/auth/session');
      if (!current()) return;
      setSession(result);
      setConnectionError('');
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        setConnectionError('');
      } else setConnectionError(message(error));
    } finally { if (current()) setLoading(false); }
  }, []);

  useEffect(() => {
    void checkSession();
    const focus = () => { void checkSession(); };
    window.addEventListener('focus', focus);
    window.addEventListener('popstate', focus);
    return () => { window.removeEventListener('focus', focus); window.removeEventListener('popstate', focus); };
  }, [checkSession]);
  useEffect(() => {
    if (loading || connectionError) return;
    const path = session ? '/parque' : '/login';
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  }, [session, loading, connectionError]);
  useEffect(() => {
    if (!session) { setPark(''); return; }
    const expired = () => { setSession(null); setNotice('Sua sessão expirou. Entre novamente.'); };
    const timeout = window.setTimeout(expired, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    const interval = window.setInterval(() => { void checkSession(); }, 30000);
    let active = true;
    void api<{ message: string }>('/park').then(result => { if (active) setPark(result.message); }).catch(error => {
      if (!active) return;
      if (error instanceof ApiError && error.status === 401) expired();
      else setActionError(message(error));
    });
    return () => { active = false; window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [session?.expiresAt, checkSession]);

  async function enter(event: FormEvent) {
    event.preventDefault();
    authEpoch.current++; authAction.current = true;
    setBusy(true); setActionError(''); setNotice('');
    try {
      const current = await api<AuthSession>('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      setPassword(''); setConnectionError(''); setSession(current);
    } catch (error) { setActionError(message(error)); setPassword(''); }
    finally { authAction.current = false; setBusy(false); }
  }
  async function leave() {
    authEpoch.current++; authAction.current = true;
    setBusy(true); setActionError('');
    try {
      await api<void>('/auth/logout', { method: 'POST' });
      setSession(null); setPassword(''); setNotice('Você saiu da aplicação.');
    } catch (error) { setActionError(message(error)); }
    finally { authAction.current = false; setBusy(false); }
  }

  return (
    <main className={!session ? 'login-layout' : undefined}>
      <header>
        <p className="eyebrow">Documentação de infraestrutura</p>
        <h1>Topologia New</h1>
        <p className="intro">Plantas, mesas, racks e conexões em um só lugar.</p>
      </header>
      {loading ? <section className="panel" role="status">Verificando sua sessão…</section> : connectionError ? (
        <section className="panel"><p role="alert" className="error">{connectionError}</p><button onClick={() => { setLoading(true); void checkSession(); }}>Tentar novamente</button></section>
      ) : !session ? (
        <section className="panel" aria-labelledby="login-title">
          <h2 id="login-title">Entrar na aplicação</h2>
          <p className="intro">Use o acesso fornecido pelo administrador.</p>
          {notice && <p role="status">{notice}</p>}
          <form onSubmit={event => void enter(event)} aria-busy={busy}>
            <label htmlFor="login">Login</label>
            <input id="login" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={100} autoFocus value={login} onChange={event => setLogin(event.target.value)} disabled={busy} />
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} aria-describedby={actionError ? 'login-error' : undefined} />
            {actionError && <p id="login-error" role="alert" className="error">{actionError}</p>}
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="park-title">
            <div className="panel-header"><h2 id="park-title">Parque de infraestrutura</h2><button className="logout" disabled={busy} onClick={() => void leave()}>{busy ? 'Saindo…' : 'Sair'}</button></div>
            <p>Olá, <strong>{session.user.name}</strong>.</p>
            <p className="intro">{session.user.isAdmin ? 'Administrador geral' : 'Usuário autenticado'}</p>
            <p>{park || 'Carregando…'}</p>
            {actionError && <p role="alert" className="error">{actionError}</p>}
          </section>
          <HealthPanel />
        </>
      )}
    </main>
  );
}
