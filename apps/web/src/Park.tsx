import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { NamedEntity, ParkSnapshot, Unit } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';

export function navigatePark(changes: Record<string, string>) {
  const query = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(changes)) { if (value) query.set(key, value); else query.delete(key); }
  history.pushState(null, '', `/parque?${query}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function Collection({ title, singular, gender = 'o', path, items, writable, selected, select, refresh, checkSession, unit = false }: {
  title: string; singular: string; gender?: 'o' | 'a'; path: string; items: NamedEntity[]; writable: boolean;
  selected?: string; select?: (id: string) => void; refresh: () => Promise<void>; checkSession: () => Promise<void>; unit?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState(''), [classification, setClassification] = useState('Matriz');
  const [deleting, setDeleting] = useState<NamedEntity | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (!writable) { setEditing(null); setDeleting(null); } }, [writable]);
  const fieldId = `${singular}-name`, classificationId = `${singular}-classification`;
  function edit(item?: NamedEntity) {
    setEditing(item?.id ?? ''); setName(item?.name ?? ''); setClassification(item ? (item as Unit).classification ?? 'Matriz' : 'Matriz');
    setDeleting(null); setError(''); setNotice('');
  }
  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await work();
      if (!active.current) return;
      setEditing(null); setDeleting(null); setNotice(success);
      await refresh();
    } catch (e) {
      if (!active.current) return;
      setError(message(e));
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { await refresh(); if (e.status === 401) void checkSession(); }
    } finally { if (active.current) setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void perform(async () => { await api(editing ? `${path}/${editing}` : path, json(editing ? 'PATCH' : 'POST', { name, ...(unit ? { classification } : {}) })); }, `${singular.charAt(0).toUpperCase()}${singular.slice(1)} salv${gender}.`);
  }
  return <section className="park-collection" aria-label={title} aria-busy={busy}>
    <div className="panel-header"><h3>{title}</h3>{writable && <button className="secondary" disabled={busy} onClick={() => edit()}>{gender === 'a' ? 'Nova' : 'Novo'} {singular}</button>}</div>
    {!items.length && <p className="empty-state">Nenhum{gender === 'a' ? 'a' : ''} {singular} cadastrad{gender} neste contexto.{writable ? ` Use “${gender === 'a' ? 'Nova' : 'Novo'} ${singular}” para começar.` : ''}</p>}
    {items.length > 0 && <ul className="park-list">{items.map(item => <li key={item.id}>
      <div className="park-item-name">{select ? <button className="secondary" aria-label={`Abrir ${singular} ${item.name}`} aria-pressed={selected === item.id} disabled={busy} onClick={() => select(item.id)}>{item.name}</button> : <strong>{item.name}</strong>}{unit && <span className="badge">{(item as Unit).classification}</span>}</div>
      {writable && <div className="park-actions"><button className="secondary" disabled={busy} aria-label={`Editar ${singular} ${item.name}`} onClick={() => edit(item)}>Editar</button><button className="secondary" disabled={busy} aria-label={`Excluir ${singular} ${item.name}`} onClick={() => { setDeleting(item); setEditing(null); setError(''); setNotice(''); }}>Excluir</button></div>}
    </li>)}</ul>}
    {writable && editing !== null && <form onSubmit={save}>
      <h4>{editing ? 'Editar' : gender === 'a' ? 'Nova' : 'Novo'} {singular}</h4>
      <label htmlFor={fieldId}>Nome {gender === 'a' ? 'da' : 'do'} {singular}</label>
      <input id={fieldId} value={name} onChange={e => setName(e.target.value)} required maxLength={200} pattern=".*\S.*" disabled={busy} autoFocus />
      {unit && <><label htmlFor={classificationId}>Classificação da unidade</label><input id={classificationId} list="unit-classifications" value={classification} onChange={e => setClassification(e.target.value)} required maxLength={200} pattern=".*\S.*" disabled={busy} /><datalist id="unit-classifications"><option value="Matriz" /><option value="Filial" /><option value="CD" /></datalist><p className="intro hint">Matriz, Filial, CD ou outra identificação livre.</p></>}
      {singular === 'planta' && <p className="intro">Você pode criar a planta sem imagem. O desenho e a importação serão disponibilizados nas próximas etapas.</p>}
      <div className="park-actions"><button type="submit" disabled={busy}>Salvar {singular}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>Cancelar</button></div>
    </form>}
    {writable && deleting && <div className="delete-confirm" role="group" aria-label={`Confirmar exclusão de ${deleting.name}`}>
      <p>Excluir <strong>{deleting.name}</strong> definitivamente? A exclusão só será permitida se não houver dependências.</p>
      <div className="park-actions"><button disabled={busy} onClick={() => void perform(async () => { await api(`${path}/${deleting.id}`, { method: 'DELETE' }); }, 'Cadastro excluído.')}>Confirmar exclusão</button><button className="secondary" disabled={busy} onClick={() => { setDeleting(null); setError(''); }}>Cancelar exclusão</button></div>
    </div>}
    {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="success">{notice}</p>}
  </section>;
}

export function Park({ data, refresh, checkSession }: { data: ParkSnapshot; refresh: () => Promise<void>; checkSession: () => Promise<void> }) {
  const [search, setSearch] = useState(location.search);
  useEffect(() => { const sync = () => setSearch(location.search); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const query = new URLSearchParams(search);
  const unit = data.units.find(item => item.id === query.get('unidade'));
  const floor = data.floors.find(item => item.id === query.get('andar') && item.unitId === unit?.id);
  const plan = data.plans.find(item => item.id === query.get('planta') && item.floorId === floor?.id);
  const datacenter = data.datacenters.find(item => item.id === query.get('datacenter') && item.unitId === unit?.id);
  const base = `/companies/${data.company.id}`, writable = data.company.role !== 'viewer';
  const common = { writable, refresh, checkSession };
  return <div className="park-context">
    <nav className="breadcrumbs" aria-label="Contexto do parque">
      <button className="secondary" onClick={() => navigatePark({ unidade: '', andar: '', planta: '', datacenter: '' })}>{data.company.name}</button>
      {unit && <><span aria-hidden="true">/</span><button className="secondary" onClick={() => navigatePark({ andar: '', planta: '', datacenter: '' })}>{unit.name}</button></>}
      {floor && <><span aria-hidden="true">/</span><button className="secondary" onClick={() => navigatePark({ planta: '', datacenter: '' })}>{floor.name}</button></>}
      {(plan || datacenter) && <><span aria-hidden="true">/</span><strong>{plan?.name ?? datacenter?.name}</strong></>}
    </nav>
    {((query.get('unidade') && !unit) || (query.get('andar') && !floor) || (query.get('planta') && !plan) || (query.get('datacenter') && !datacenter)) && <p role="alert" className="error">O contexto selecionado não está disponível nesta empresa. Selecione um cadastro abaixo.</p>}
    <Collection {...common} title="Unidades" singular="unidade" gender="a" path={`${base}/units`} items={data.units} selected={unit?.id} select={id => navigatePark({ unidade: id, andar: '', planta: '', datacenter: '' })} unit />
    {!unit && data.units.length > 0 && <p className="empty-state">Selecione uma unidade para consultar seus andares e datacenters.</p>}
    {unit && <div key={unit.id}>
      <h3>Unidade: {unit.name}</h3>
      <Collection {...common} title="Andares" singular="andar" path={`${base}/units/${unit.id}/floors`} items={data.floors.filter(item => item.unitId === unit.id)} selected={floor?.id} select={id => navigatePark({ andar: id, planta: '', datacenter: '' })} />
      {floor ? <div key={floor.id}>
        <h3>Andar: {floor.name}</h3>
        <Collection {...common} title="Plantas" singular="planta" gender="a" path={`${base}/units/${unit.id}/floors/${floor.id}/plans`} items={data.plans.filter(item => item.floorId === floor.id)} selected={plan?.id} select={id => navigatePark({ planta: id, datacenter: '' })} />
        {plan && <section className="park-detail"><h4>Planta: {plan.name}</h4><p>Planta cadastrada neste andar. Desenho, importação e posicionamento de objetos serão disponibilizados nas próximas etapas.</p></section>}
      </div> : <p className="empty-state">Selecione um andar para consultar suas plantas.</p>}
      <Collection {...common} title="Datacenters da unidade" singular="datacenter" path={`${base}/units/${unit.id}/datacenters`} items={data.datacenters.filter(item => item.unitId === unit.id)} selected={datacenter?.id} select={id => navigatePark({ datacenter: id, andar: '', planta: '' })} />
      {datacenter && <section className="park-detail"><h4>Datacenter: {datacenter.name}</h4><p>Datacenter vinculado à unidade {unit.name}. O cadastro de racks será disponibilizado na etapa 07.</p></section>}
    </div>}
  </div>;
}
