import { useEffect, useRef, useState } from 'react';
import { publicTokenPattern, type PublicDesk as Desk } from '@topologia-new/domain';
import { Brand } from './Brand';

/** Entrada pública isolada: sem App, sessão, snapshot, navegação ou links internos. */
export function PublicDesk() {
  const token = location.pathname.slice('/mesa/'.length);
  const [desk, setDesk] = useState<Desk | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    document.title = 'Consulta da mesa';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'; document.head.append(robots);
    const controller = new AbortController();
    async function load() {
      const current = ++generation.current;
      document.title = 'Consulta da mesa';
      setLoading(true); setDesk(null); setError('');
      try {
        if (!publicTokenPattern.test(token)) throw new Error('Mesa pública indisponível.');
        const response = await fetch(`/api/public/desks/${token}`, { credentials: 'omit', cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error(response.status === 404 ? 'Mesa pública indisponível.' : 'Não foi possível carregar a mesa. Tente novamente.');
        const data = await response.json() as Desk;
        if (current === generation.current) { setDesk(data); document.title = `Mesa: ${data.name}`; }
      } catch (e) {
        if (current === generation.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar a mesa.');
      } finally { if (current === generation.current) setLoading(false); }
    }
    const focus = () => { void load(); };
    void load(); const interval = window.setInterval(focus, 30000);
    window.addEventListener('focus', focus);
    return () => { generation.current++; controller.abort(); clearInterval(interval); window.removeEventListener('focus', focus); robots.remove(); };
  }, [token]);
  return <main className="public-desk">
    <Brand />
    <p className="eyebrow">Consulta da mesa</p>
    {loading && <section className="panel" role="status">Carregando mesa…</section>}
    {error && <section className="panel"><h1>Mesa indisponível</h1><p role="alert" className="error">{error}</p>
      <button onClick={() => location.reload()}>Tentar novamente</button></section>}
    {desk && <><h1>{desk.name}</h1><p>{desk.points.length} pontos</p>
      {!desk.points.length && <section className="panel">Esta mesa ainda não possui pontos.</section>}
      <ul className="public-points">{desk.points.map((point, index) => <li className="panel" key={index}>
        <h2>{point.name}</h2><span className={`badge ${point.destination ? 'online' : ''}`}>{point.destination ? 'Associado' : 'Não associado'}</span>
        {point.destination ? <dl>{(['datacenter', 'rack', 'patchPanel', 'port'] as const).map(key => <div key={key}>
          <dt>{{ datacenter: 'Datacenter', rack: 'Rack', patchPanel: 'Patch panel', port: 'Porta' }[key]}</dt><dd>{point.destination![key]}</dd>
        </div>)}</dl> : <p>Sem destino associado.</p>}
      </li>)}</ul>
    </>}
  </main>;
}
