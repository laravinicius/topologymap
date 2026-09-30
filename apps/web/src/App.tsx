import { useCallback, useEffect, useState } from 'react';

type Health = { status: 'ok' | 'degraded'; database: 'up' | 'down'; checkedAt: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);

  const check = useCallback(async (signal: AbortSignal) => {
    setChecking(true);
    setError(false);
    try {
      const response = await fetch('/api/health', { signal });
      if (response.status !== 200 && response.status !== 503) throw new Error('Resposta inesperada');
      const result = await response.json() as Health;
      if (!signal.aborted) setHealth(result);
    } catch {
      if (!signal.aborted || signal.reason?.name === 'TimeoutError') {
        setHealth(null);
        setError(true);
      }
    } finally {
      if (!signal.aborted || signal.reason?.name === 'TimeoutError') setChecking(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void check(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
    return () => controller.abort();
  }, [check]);

  const online = health?.status === 'ok' && !error;
  return (
    <main>
      <header>
        <p className="eyebrow">Ambiente de desenvolvimento</p>
        <h1>Topologia New</h1>
        <p className="intro">Base local para documentar plantas, mesas, racks e conexões.</p>
      </header>

      <section className="panel" aria-labelledby="health-title">
        <div className="panel-header">
          <h2 id="health-title">Estado do ambiente</h2>
          <span className={`badge ${online ? 'online' : ''}`}>
            {checking ? 'Verificando…' : online ? 'Operacional' : 'Indisponível'}
          </span>
        </div>
        <div role="status" aria-live="polite" aria-busy={checking}>
          <dl>
            <div><dt>Interface</dt><dd>Em execução</dd></div>
            <div><dt>API</dt><dd>{checking ? 'Verificando…' : health ? 'Em execução' : 'Sem resposta'}</dd></div>
            <div><dt>PostgreSQL</dt><dd>{checking ? 'Verificando…' : health?.database === 'up' ? 'Conectado' : 'Indisponível'}</dd></div>
          </dl>
          {error && <p className="error">Não foi possível consultar a API. Confira os logs e tente novamente.</p>}
          {health?.database === 'down' && <p className="error">A API respondeu, mas o banco está indisponível.</p>}
          {health && !checking && <p className="checked">Última verificação: {new Date(health.checkedAt).toLocaleString('pt-BR')}</p>}
        </div>
        <button type="button" disabled={checking} onClick={() => void check(AbortSignal.timeout(5000))}>
          {checking ? 'Verificando…' : 'Verificar novamente'}
        </button>
      </section>

      <section className="scope" aria-labelledby="scope-title">
        <h2 id="scope-title">Etapa 01 · Workspace e Docker local</h2>
        <p>Ambiente inicial sem cadastros de clientes. Os recursos de acesso, cadastro e desenho serão entregues nas próximas etapas.</p>
      </section>
    </main>
  );
}
