import { useEffect, useRef, useState } from 'react';
import type { SearchKind, SearchResult } from '@topologia-new/domain';
import { api, message } from './api';
import { pushNavigation, targetURL } from './navigation';

/** Resolve novamente antes de navegar: exclusão, filiação e permissão podem ter mudado. */
export function ObjectLink({ companyId, kind, id, children, view = 'list' }: {
  companyId: string; kind: SearchKind; id: string; children: React.ReactNode; view?: 'list' | 'plan';
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  const navigation = useRef(0);
  useEffect(() => {
    active.current = true;
    const changed = () => { navigation.current++; };
    window.addEventListener('popstate', changed);
    return () => { active.current = false; window.removeEventListener('popstate', changed); };
  }, []);
  async function open() {
    if (busy) return;
    setBusy(true); setError('');
    const currentNavigation = navigation.current;
    try {
      const result = await api<SearchResult>(`/companies/${encodeURIComponent(companyId)}/locate/${kind}/${encodeURIComponent(id)}`);
      if (!active.current || currentNavigation !== navigation.current) return;
      if (view === 'plan' && !result.target.planId) { setError('Objeto sem planta. Consulte pela lista.'); return; }
      pushNavigation(targetURL(result, view, location.search));
    } catch (e) { if (active.current && currentNavigation === navigation.current) setError(message(e)); }
    finally { if (active.current) setBusy(false); }
  }
  return <span className="object-link"><button type="button" className="secondary" disabled={busy} onClick={() => void open()}>{children}</button>{error && <span className="error" role="alert">{error}</span>}</span>;
}
