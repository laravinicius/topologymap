import { useEffect, useState } from 'react';
import { searchKinds, type AccessibleCompany, type SearchResponse } from '@topologia-new/domain';
import { api, ApiError, message } from './api';
import { ObjectLink } from './ObjectLink';
import { navigatePark } from './navigation';

const labels = { plan: 'Planta', desk: 'Mesa', point: 'Ponto', datacenter: 'Datacenter', rack: 'Rack', patch_panel: 'Patch panel', port: 'Porta' };
export function Search({ companies, checkSession }: { companies: AccessibleCompany[]; checkSession: () => Promise<void> }) {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search));
  const [text, setText] = useState(query.get('busca') ?? '');
  const [result, setResult] = useState<SearchResponse | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    const sync = () => { const next = new URLSearchParams(location.search); setQuery(next); setText(next.get('busca') ?? ''); };
    window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync);
  }, []);
  const params = new URLSearchParams();
  for (const [key, field] of [['busca', 'q'], ['fEmpresa', 'companyId'], ['fUnidade', 'unitId'], ['fAndar', 'floorId'], ['fSetor', 'sectorId'], ['tipo', 'kind'], ['pagina', 'offset']]) {
    if (query.get(key!)) params.set(field!, query.get(key!)!);
  }
  const request = params.toString();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    void api<SearchResponse>(`/search?${request}`, { signal: controller.signal }).then(value => {
      if (active) setResult(value);
    }).catch(e => {
      if (active) { setError(message(e)); if (e instanceof ApiError && e.status === 401) void checkSession(); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [request, companies, checkSession]);
  const change = (key: string, value: string) => navigatePark({ pagina: '', avisoBusca: '', [key]: value,
    ...(key === 'fEmpresa' ? { fUnidade: '', fAndar: '', fSetor: '' } : key === 'fUnidade' ? { fAndar: '', fSetor: '' } : key === 'fAndar' ? { fSetor: '' } : {}) });
  return <section className="park-search" aria-label="Busca no parque" aria-busy={loading}>
    <h3>Busca e lista do parque</h3>
    <p className="intro">Consulte cadastros de todas as empresas autorizadas, inclusive racks sem planta ou sem posição.</p>
    {query.get('avisoBusca') === 'ajustado' && <p role="status" className="success">O destino está fora dos filtros anteriores. A busca foi limpa para abrir o contexto correto.</p>}
    <form aria-label="Pesquisar objetos" onSubmit={e => { e.preventDefault(); change('busca', text.trim()); }}>
      <label htmlFor="park-search-text">Nome do objeto</label>
      <div className="search-input"><input id="park-search-text" maxLength={200} value={text} onChange={e => setText(e.target.value)} /><button type="submit">Buscar</button></div>
    </form>
    <div className="search-filters">
      <div><label htmlFor="search-company">Filtrar empresa</label><select id="search-company" value={query.get('fEmpresa') ?? ''} onChange={e => change('fEmpresa', e.target.value)}>
        <option value="">Todas as empresas autorizadas</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {(['units', 'floors', 'sectors'] as const).map((facet, i) => {
        const key = ['fUnidade', 'fAndar', 'fSetor'][i]!;
        const rows = result?.facets[facet] ?? [];
        return <div key={facet}><label htmlFor={`search-${facet}`}>{['Filtrar unidade', 'Filtrar andar', 'Filtrar setor'][i]}</label>
          <select id={`search-${facet}`} value={query.get(key) ?? ''} disabled={loading} onChange={e => change(key, e.target.value)}>
            <option value="">{['Todas as unidades', 'Todos os andares', 'Todos os setores'][i]}</option>
            {query.get(key) && !rows.some(row => row.id === query.get(key)) && <option value={query.get(key)!}>Filtro indisponível</option>}
            {rows.map(row => <option key={row.id} value={row.id}>{row.context} / {row.name}</option>)}
          </select>{facet === 'sectors' && <p className="intro hint">Setor filtra mesas e seus pontos.</p>}</div>;
      })}
      <div><label htmlFor="search-kind">Tipo de objeto</label><select id="search-kind" value={query.get('tipo') ?? ''} onChange={e => change('tipo', e.target.value)}>
        <option value="">Todos os tipos</option>{searchKinds.map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}</select></div>
    </div>
    <button type="button" className="secondary" onClick={() => navigatePark({ busca: '', fEmpresa: '', fUnidade: '', fAndar: '', fSetor: '', tipo: '', pagina: '', avisoBusca: '' })}>Limpar busca e filtros</button>
    {loading && <p role="status">Buscando objetos…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {result && <>
      <p role="status">{result.total} resultado(s){result.total > 0 && ` · ${result.offset + 1}–${Math.min(result.total, result.offset + result.limit)}`}</p>
      {!result.total && <p className="empty-state">Nenhum objeto encontrado. Confira o nome ou limpe os filtros.</p>}
      <ul className="park-list search-results">{result.results.map(item => <li key={`${item.kind}:${item.id}`}>
        <div><strong>{labels[item.kind]}: {item.name}</strong><p>{item.context}</p>
          {item.kind !== 'plan' && !item.positioned && <span className="badge">{item.target.planId ? 'Sem posição na planta' : 'Sem planta'}</span>}</div>
        <div className="park-actions"><ObjectLink companyId={item.target.companyId} kind={item.kind} id={item.id}>Consultar {labels[item.kind].toLowerCase()} {item.name}</ObjectLink>
          {item.target.planId && item.kind !== 'datacenter' && <ObjectLink companyId={item.target.companyId} kind={item.kind} id={item.id} view="plan">Localizar na planta</ObjectLink>}</div>
      </li>)}</ul>
      <div className="park-actions"><button className="secondary" disabled={result.offset === 0} onClick={() => change('pagina', String(Math.max(0, result.offset - result.limit)))}>Resultados anteriores</button>
        <button className="secondary" disabled={result.offset + result.limit >= result.total} onClick={() => change('pagina', String(result.offset + result.limit))}>Próximos resultados</button></div>
    </>}
  </section>;
}
