import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthSession, AccessibleCompany } from '@topologia-new/domain';
import { api, ApiError, message } from './api';
import { Administration } from './Administration';

export function Workspace({ session, checkSession }: { session: AuthSession; checkSession: () => Promise<void> }) {
  const [companies, setCompanies] = useState<AccessibleCompany[]>([]);
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('empresa') ?? '');
  const [company, setCompany] = useState<AccessibleCompany | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(location.pathname === '/administracao');
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const number = ++requestNumber.current;
    try {
      const result = await api<{ companies: AccessibleCompany[] }>('/companies');
      if (number !== requestNumber.current) return;
      setCompanies(result.companies);
      if (selected) {
        const detail = await api<{ company: AccessibleCompany }>(`/companies/${encodeURIComponent(selected)}/park`);
        if (number !== requestNumber.current) return;
        setCompany(detail.company);
      } else setCompany(null);
      setError('');
    } catch (e) {
      if (number !== requestNumber.current) return;
      setCompany(null); setError(message(e));
      if (e instanceof ApiError && e.status === 401) { setCompanies([]); void checkSession(); }
    } finally { if (number === requestNumber.current) setLoading(false); }
  }, [selected, checkSession]);
  useEffect(() => {
    setCompany(null); setLoading(true); void refresh();
    const focus = () => { void refresh(); };
    const interval = window.setInterval(focus, 30000);
    window.addEventListener('focus', focus);
    return () => { requestNumber.current++; window.clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [refresh]);
  useEffect(() => {
    const sync = () => { setAdmin(location.pathname === '/administracao'); setSelected(new URLSearchParams(location.search).get('empresa') ?? ''); };
    window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync);
  }, []);
  function navigate(path: string) { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
  return <>
    <nav className="workspace-nav" aria-label="Navegação principal">
      <button className={!admin ? undefined : 'secondary'} aria-current={!admin ? 'page' : undefined} onClick={() => navigate(`/parque${selected ? `?empresa=${encodeURIComponent(selected)}` : ''}`)}>Empresas autorizadas</button>
      {session.user.isAdmin && <button className={admin ? undefined : 'secondary'} aria-current={admin ? 'page' : undefined} onClick={() => navigate('/administracao')}>Administração</button>}
    </nav>
    {admin && error && <p role="alert" className="error">{error}</p>}
    {admin && session.user.isAdmin ? <Administration companies={companies} refreshCompanies={refresh} checkSession={checkSession} /> : <section className="panel" aria-labelledby="companies-access-title">
      <div className="panel-header"><h2 id="companies-access-title">Empresas autorizadas</h2><button className="secondary" onClick={() => void refresh()}>Atualizar acessos</button></div>
      {loading && <p role="status">Carregando empresas…</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {!loading && !companies.length && <p>{session.user.isAdmin ? 'Nenhuma empresa cadastrada. Abra Administração para criar a primeira empresa.' : 'Você ainda não tem acesso a empresas. Solicite a concessão ao administrador geral.'}</p>}
      {companies.length > 0 && <>
        <label htmlFor="company-selector">Empresa</label>
        <select id="company-selector" value={companies.some(c => c.id === selected) ? selected : ''} onChange={e => navigate(`/parque${e.target.value ? `?empresa=${encodeURIComponent(e.target.value)}` : ''}`)}>
          <option value="">Selecione uma empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name} — {c.role === 'admin' ? 'Administrador geral' : c.role === 'manager' ? 'Gerenciamento' : 'Visualização'}</option>)}
        </select>
      </>}
      {company && <div className="company-context">
        <h3>{company.name}</h3><p className="badge">{company.role === 'admin' ? 'Administrador geral' : company.role === 'manager' ? 'Gerenciamento' : 'Visualização — somente consulta'}</p>
        <p>O cadastro de unidades e a navegação pelo parque serão disponibilizados na etapa 05.</p>
      </div>}
    </section>}
  </>;
}
