import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { deskLimits, type DeskDetail, type DeskSummary, type Rectangle, type ParkSnapshot } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { navigatePark } from './Park';

const defaultPlacement: Rectangle = { x: 0, y: 0, width: 1.2, height: 0.6, rotation: 0 };
export function Desks({ path, selected, writable, park, refresh, checkSession }: {
  path: string; selected: string; writable: boolean; park: ParkSnapshot; refresh: () => Promise<void>; checkSession: () => Promise<void>;
}) {
  const [items, setItems] = useState<DeskSummary[]>([]), [detail, setDetail] = useState<DeskDetail | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<DeskDetail | 'new' | null>(null), [name, setName] = useState(''), [quantity, setQuantity] = useState('8');
  const [position, setPosition] = useState(defaultPlacement);
  const [pointId, setPointId] = useState(''), [pointName, setPointName] = useState('');
  const [deleting, setDeleting] = useState<{ path: string; name: string } | null>(null);
  const generation = useRef(0), active = useRef(true), alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  async function load() {
    const current = ++generation.current;
    let listed = false;
    try {
      const list = await api<{ desks: DeskSummary[] }>(path);
      if (!active.current || current !== generation.current) return;
      setItems(list.desks); listed = true;
      const row = selected ? await api<DeskDetail>(`${path}/${selected}`) : null;
      if (!active.current || current !== generation.current) return;
      setItems(list.desks); setDetail(row);
    } catch (e) {
      if (!active.current || current !== generation.current) return;
      if (!listed) setItems([]);
      setDetail(null); setError(message(e));
      if (e instanceof ApiError && e.status === 401) void checkSession();
    } finally { if (active.current && current === generation.current) setLoading(false); }
  }
  useEffect(() => { setDetail(null); setEditing(null); setPointId(''); setDeleting(null); setError(''); setLoading(true); void load();
    return () => { generation.current++; };
    // O snapshot do parque é revalidado por foco, intervalo e atualização manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, selected]);
  useEffect(() => { void load(); }, [park]);
  useEffect(() => { if (!writable) { setEditing(null); setPointId(''); setDeleting(null); } }, [writable]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  function edit(row?: DeskDetail) {
    setEditing(row ?? 'new'); setName(row?.name ?? ''); setQuantity(String(row?.pointCount ?? 8));
    setPosition(row?.placement ?? defaultPlacement); setPointId(''); setDeleting(null); setError(''); setNotice('');
  }
  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); if (!active.current) return;
      setEditing(null); setPointId(''); setDeleting(null); setNotice(success); await load(); await refresh();
    } catch (e) { if (!active.current) return; setError(message(e));
      if (e instanceof ApiError && [401, 403, 404, 409].includes(e.status)) { await load(); await refresh(); }
    } finally { if (active.current) setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const pointCount = Number(quantity), existing = editing && editing !== 'new' ? editing : null;
    if (existing && pointCount < existing.pointCount) {
      setDeleting({ path: 'reduce', name: `${existing.pointCount - pointCount} último(s) ponto(s) de ${existing.name}` }); return;
    }
    persist();
  }
  function persist() {
    const existing = editing && editing !== 'new' ? editing : null;
    void perform(async () => {
      const row = await api<DeskDetail>(existing ? `${path}/${existing.id}` : path, json(existing ? 'PATCH' : 'POST', {
        name, placement: position, pointCount: Number(quantity), ...(existing ? { expectedPointIds: existing.points.map(p => p.id) } : {}),
      }));
      if (!existing && active.current) navigatePark({ mesa: row.id });
    }, 'Mesa salva.');
  }
  return <section className="park-collection" aria-label="Mesas" aria-busy={busy || loading}>
    <div className="panel-header"><h3>Mesas da planta</h3>{writable && <button className="secondary" disabled={busy} onClick={() => edit()}>Nova mesa</button>}</div>
    {error && <p ref={alert} tabIndex={-1} role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    {loading && <p role="status">Carregando mesas…</p>}
    {!loading && !items.length && <p className="empty-state">Nenhuma mesa cadastrada nesta planta. {writable && 'Crie uma mesa com seus pontos, mesmo sem racks.'}</p>}
    <ul className="park-list">{items.map(row => <li key={row.id}><div className="park-item-name">
      <button className="secondary" aria-label={`Abrir mesa ${row.name}`} aria-pressed={selected === row.id} disabled={busy} onClick={() => navigatePark({ mesa: row.id })}>{row.name}</button>
      <span className="badge">{row.pointCount} pontos</span>
    </div></li>)}</ul>
    {detail && <div className="park-detail">
      <div className="panel-header"><h4>Mesa: {detail.name}</h4>{writable && <div className="park-actions">
        <button className="secondary" disabled={busy} onClick={() => edit(detail)}>Editar mesa</button>
        <button className="secondary" disabled={busy} onClick={() => { setDeleting({ path: `${path}/${detail.id}`, name: detail.name }); setEditing(null); }}>Excluir mesa</button>
      </div>}</div>
      <p>{detail.pointCount} pontos · Centro ({detail.placement.x}, {detail.placement.y}) m · {detail.placement.width} × {detail.placement.height} m · Rotação {detail.placement.rotation}°</p>
      {!detail.points.length && <p className="empty-state">Esta mesa ainda não possui pontos.</p>}
      <ul className="park-list">{detail.points.map(p => <li key={p.id}><div className="park-item-name"><strong>{p.name}</strong><span className="badge">{p.connectionId ? 'Associado' : 'Não associado'}</span></div>
        {writable && <div className="park-actions"><button className="secondary" disabled={busy} aria-label={`Editar ponto ${p.name}`} onClick={() => { setPointId(p.id); setPointName(p.name); setEditing(null); setDeleting(null); setError(''); }}>Editar</button>
          <button className="secondary" disabled={busy} aria-label={`Excluir ponto ${p.name}`} onClick={() => { setDeleting({ path: `${path}/${detail.id}/points/${p.id}`, name: p.name }); setEditing(null); setPointId(''); }}>Excluir</button></div>}
      </li>)}</ul>
    </div>}
    {writable && editing && <form onSubmit={save} aria-label="Cadastro de mesa">
      <h4>{editing === 'new' ? 'Nova mesa' : 'Editar mesa'}</h4>
      <label htmlFor="desk-name">Nome da mesa</label><input id="desk-name" required maxLength={200} pattern=".*\S.*" value={name} disabled={busy} autoFocus onChange={e => setName(e.target.value)} />
      <label htmlFor="desk-quantity">Quantidade de pontos</label><input id="desk-quantity" type="number" min={0} max={deskLimits.points} step={1} required value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} aria-describedby="desk-quantity-help" />
      <p className="intro hint" id="desk-quantity-help">De 0 a {deskLimits.points}. Nomes iniciais: Ponto 1, Ponto 2… Ampliar mantém os pontos existentes. Reduzir remove os últimos pontos da lista, somente sem conexão e após confirmação.</p>
      <fieldset disabled={busy}><legend>Posição e dimensões em metros</legend><div className="placement-fields">{(['x', 'y', 'width', 'height', 'rotation'] as const).map(key => <div key={key}>
        <label htmlFor={`desk-${key}`}>{{ x: 'Centro X (m)', y: 'Centro Y (m)', width: 'Largura (m)', height: 'Profundidade (m)', rotation: 'Rotação (graus)' }[key]}</label>
        <input id={`desk-${key}`} type="number" step="any" required value={position[key]} min={key === 'x' || key === 'y' ? -deskLimits.coordinate : key === 'rotation' ? 0 : 0.000001} max={key === 'x' || key === 'y' ? deskLimits.coordinate : key === 'rotation' ? 359.999999 : deskLimits.dimension} onChange={e => setPosition({ ...position, [key]: e.target.valueAsNumber })} />
      </div>)}</div></fieldset>
      <div className="park-actions"><button disabled={busy} type="submit">Salvar mesa</button><button disabled={busy} type="button" className="secondary" onClick={() => { setEditing(null); setDeleting(null); }}>Cancelar</button></div>
    </form>}
    {writable && pointId && detail && <form aria-label="Editar ponto" onSubmit={e => { e.preventDefault(); void perform(async () => { await api(`${path}/${detail.id}/points/${pointId}`, json('PATCH', { name: pointName })); }, 'Ponto salvo.'); }}>
      <label htmlFor="point-name">Nome do ponto</label><input id="point-name" required maxLength={200} pattern=".*\S.*" autoFocus value={pointName} disabled={busy} onChange={e => setPointName(e.target.value)} />
      <div className="park-actions"><button disabled={busy}>Salvar ponto</button><button type="button" className="secondary" disabled={busy} onClick={() => setPointId('')}>Cancelar</button></div>
    </form>}
    {writable && deleting && <div className="delete-confirm" role="group" aria-label="Confirmar remoção">
      <p>Remover <strong>{deleting.name}</strong> definitivamente? Pontos com conexão são protegidos. Para excluir uma mesa, remova seus pontos primeiro.</p>
      <div className="park-actions"><button disabled={busy} onClick={() => deleting.path === 'reduce' ? persist() : void perform(async () => { await api(deleting.path, { method: 'DELETE' }); if (deleting.path === `${path}/${selected}`) navigatePark({ mesa: '' }); }, 'Cadastro excluído.')}>Confirmar remoção</button>
        <button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar remoção</button></div>
    </div>}
  </section>;
}
