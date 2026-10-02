import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isPlanLayout, isRectangle, type DeskSummary, type LayoutCamera, type ParkSnapshot, type PlanLayout, type PlanBackground, type RackSummary, type Rectangle } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { PlanCanvas, type CanvasObject } from './PlanCanvas';
import { ArchitecturePanel } from './ArchitecturePanel';
import { BackgroundPanel } from './BackgroundPanel';
import { worldToSource } from './background';
import { applyDrawing, drawing, drawingBounds, fitCamera, normalizeRotation, reconcile, same, type Drawing } from './layoutEditor';

type Snapshot = { revision: number; layout: PlanLayout };
type History = { past: Drawing[]; future: Drawing[] };
const emptyHistory = (): History => ({ past: [], future: [] });
const context = (url: string) => {
  const parsed = new URL(url);
  return [parsed.pathname, ...['empresa', 'unidade', 'andar', 'planta', 'datacenter'].map(key => parsed.searchParams.get(key))].join('|');
};

export function PlanEditor({ park, planId, unitId, floorId, writable, refresh, checkSession }: {
  park: ParkSnapshot; planId: string; unitId: string; floorId: string; writable: boolean;
  refresh: () => Promise<void>; checkSession: () => Promise<void>;
}) {
  const base = `/companies/${park.company.id}`, path = `${base}/plans/${planId}/layout`;
  const [baseline, setBaseline] = useState<Snapshot | null>(null), [draft, setDraft] = useState<PlanLayout | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory), [selected, setSelected] = useState('');
  const [desks, setDesks] = useState<DeskSummary[]>([]), [racks, setRacks] = useState<RackSummary[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [conflict, setConflict] = useState(false);
  const [pan, setPan] = useState(false), [grid, setGrid] = useState(true), [snap, setSnap] = useState(true), [width, setWidth] = useState(600);
  const [rackId, setRackId] = useState('');
  const [tool, setTool] = useState<'select' | 'wall' | 'sector' | 'door' | 'window' | 'calibrate'>('select');
  const [vertices, setVertices] = useState<{ x: number; y: number }[]>([]);
  const container = useRef<HTMLDivElement>(null), generation = useRef(0), writing = useRef(false), catalogGeneration = useRef(0);
  const live = useRef({ writable, draft, baseline, busy }); live.current = { writable, draft, baseline, busy };
  const dirty = !!draft && !!baseline && (!same(drawing(draft), drawing(baseline.layout)) || (writable && !same(draft, baseline.layout)));
  const objects: CanvasObject[] = draft ? [
    ...draft.desks.map(item => ({ ...item, kind: 'desks' as const, name: desks.find(value => value.id === item.id)?.name ?? item.id })),
    ...draft.racks.map(item => ({ ...item, kind: 'racks' as const, name: racks.find(value => value.id === item.id)?.name ?? item.id })),
  ] : [];
  const object = objects.find(item => item.id === selected);
  const editable = writable && !busy && !conflict;

  async function handleError(e: unknown) {
    setError(message(e));
    if (e instanceof ApiError && e.status === 409) setConflict(true);
    if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
      await refresh(); if (e.status === 401) void checkSession();
    }
  }
  async function catalog() {
    const number = ++catalogGeneration.current;
    const [deskResult, rackResults] = await Promise.all([
      api<{ desks: DeskSummary[] }>(`${base}/units/${unitId}/floors/${floorId}/plans/${planId}/desks`),
      Promise.all(park.datacenters.filter(dc => dc.unitId === unitId).map(dc => api<{ racks: RackSummary[] }>(`${base}/units/${unitId}/datacenters/${dc.id}/racks`))),
    ]);
    if (number === catalogGeneration.current) { setDesks(deskResult.desks); setRacks(rackResults.flatMap(result => result.racks)); }
  }
  async function load(mode: 'replace' | 'reconcile' = 'replace') {
    if (writing.current) return;
    if (mode === 'reconcile' && !window.confirm('Reconciliar somente posições de mesas/racks? Alterações locais de paredes, aberturas, setores, fundo e associações serão descartadas em favor da revisão atual.')) return;
    const current = live.current;
    if (mode === 'replace' && current.draft && current.baseline && (!same(drawing(current.draft), drawing(current.baseline.layout)) || (current.writable && !same(current.draft, current.baseline.layout)))
      && !window.confirm('Recarregar a planta e descartar as alterações locais?')) return;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    const number = generation.current;
    try {
      const latest = await api<Snapshot>(path);
      if (number !== generation.current) return;
      await catalog();
      if (number !== generation.current) return;
      const next = mode === 'reconcile' && current.draft && current.baseline ? reconcile(latest.layout, current.baseline.layout, current.draft) : latest.layout;
      setBaseline(latest); setDraft(next); setConflict(false); setSelected(''); setVertices([]); setTool('select');
      setHistory(same(drawing(next), drawing(latest.layout)) ? emptyHistory() : { past: [drawing(latest.layout)], future: [] });
      setNotice(mode === 'reconcile' ? 'Revisão atual carregada. Posições locais de IDs ainda existentes foram mantidas; confira e salve explicitamente.' : 'Layout carregado.');
    } catch (e) { if (number === generation.current) await handleError(e); }
    finally { if (number === generation.current) { writing.current = false; setBusy(false); } }
  }
  useEffect(() => {
    void load();
    return () => { generation.current++; catalogGeneration.current++; writing.current = false; };
    // O snapshot só é substituído por uma ação explícita; refresh do parque preserva o rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  useEffect(() => { void catalog().catch(e => { setError(message(e)); }); }, [park]);
  useEffect(() => {
    const check = async () => {
      if (writing.current || !live.current.baseline) return;
      const number = generation.current;
      try {
        const latest = await api<Snapshot>(path);
        if (number !== generation.current || writing.current) return;
        if (live.current.baseline && latest.revision > live.current.baseline.revision) {
          setConflict(true); setError(live.current.writable
            ? 'A revisão da planta mudou. Recarregue ou reconcilie as posições antes de editar ou salvar.'
            : 'A planta foi atualizada por outro usuário. Use Recarregar layout para consultar a revisão atual.');
        }
      } catch (e) { if (number === generation.current) setError(message(e)); }
    };
    const timer = window.setInterval(() => void check(), 30000);
    window.addEventListener('focus', check);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, [path]);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(1, Math.floor(entries[0]!.contentRect.width))));
    observer.observe(element); return () => observer.disconnect();
  }, [!!draft]);
  useEffect(() => {
    const allow = () => {
      const current = live.current;
      if (current.busy) { setError('Aguarde a operação do layout terminar antes de sair.'); return false; }
      return !current.draft || !current.baseline || (same(drawing(current.draft), drawing(current.baseline.layout)) && (!current.writable || same(current.draft, current.baseline.layout)))
        || window.confirm('Há alterações de layout não salvas. Sair e descartá-las?');
    };
    const navigate = (event: Event) => {
      const destination = (event as CustomEvent<{ destination?: string }>).detail?.destination;
      const currentContext = ['/parque', park.company.id, unitId, floorId, planId, null].join('|');
      if (destination && context(new URL(destination, location.href).href) === currentContext) return;
      if (!allow()) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      const current = live.current;
      if (current.busy || (current.draft && current.baseline && (!same(drawing(current.draft), drawing(current.baseline.layout)) || (current.writable && !same(current.draft, current.baseline.layout))))) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('topologia:before-navigate', navigate);
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('topologia:before-navigate', navigate); window.removeEventListener('beforeunload', unload); };
  }, [path]);

  function update(id: string, placement: Rectangle | null) {
    if (!editable || !draft || writing.current) return;
    if (placement && !isRectangle(placement)) { setError('Informe coordenadas finitas e dimensões positivas em metros.'); return; }
    const next = structuredClone(draft);
    const desk = next.desks.find(item => item.id === id), rack = next.racks.find(item => item.id === id);
    if (desk && placement) desk.placement = placement;
    else if (rack) rack.placement = placement;
    else return;
    commit(next);
  }
  function commit(next: PlanLayout) {
    if (!editable || !draft || writing.current) return;
    if (!isPlanLayout(next)) { setError('Geometria inválida: confira medidas, polígonos sem cruzamentos e aberturas dentro da parede, sem sobreposição.'); return; }
    const names = next.sectors.map(s => s.name);
    if (names.some((name, i) => name && names.indexOf(name) !== i)) { setError('Nomes de setores devem ser únicos na planta.'); return; }
    if (same(drawing(next), drawing(draft))) return;
    setHistory(value => ({ past: [...value.past.slice(-99), drawing(draft)], future: [] }));
    setDraft(next); setError(''); setNotice('');
  }
  function drawPoint(point: { x: number; y: number }, wallId?: string) {
    if (!editable || !draft || pan || tool === 'select') return;
    if (tool === 'calibrate') {
      const b = draft.geometry.background; if (!b) return;
      const p = worldToSource(b,point);
      if (p.x < 0 || p.y < 0 || p.x > b.sourceWidthPx || p.y > b.sourceHeightPx) { setError('Marque pontos dentro do fundo.'); return; }
      setVertices(old => old.length >= 2 ? [point] : [...old,point]); setError(''); return;
    }
    const next = structuredClone(draft), id = crypto.randomUUID();
    if (tool === 'wall') {
      if (!vertices.length) { setVertices([point]); return; }
      next.geometry.walls.push({ id, start: vertices[0]!, end: point, thickness: .15 });
    } else if (tool === 'sector') { setVertices([...vertices, point]); return; }
    else {
      const wall = next.geometry.walls.find(w => w.id === wallId);
      if (!wall) { setError('Clique numa parede para inserir a abertura.'); return; }
      const dx = wall.end.x-wall.start.x, dy = wall.end.y-wall.start.y, length = Math.hypot(dx,dy), size = tool === 'door' ? .9 : 1.2;
      if (length < size) { setError('A parede é menor que a abertura. Use os campos para ajustar a largura.'); return; }
      const offset = Math.max(0, Math.min(length-size, ((point.x-wall.start.x)*dx+(point.y-wall.start.y)*dy)/length-size/2));
      next.geometry.openings.push({ id, kind: tool, wallId: wall.id, offset, width: size });
    }
    if (isPlanLayout(next)) { commit(next); setSelected(id); setVertices([]); }
    else commit(next);
  }
  function finishSector() {
    if (!draft) return;
    const next = structuredClone(draft), id = crypto.randomUUID();
    let n = 1; while (next.sectors.some(s => s.name === `Setor ${n}`)) n++;
    next.sectors.push({ id, name: `Setor ${n}`, polygon: vertices });
    if (isPlanLayout(next)) { commit(next); setSelected(id); setVertices([]); setTool('select'); }
    else commit(next);
  }
  function undo(redo = false) {
    if (!editable || !draft) return;
    const source = redo ? history.future : history.past, target = source.at(-1); if (!target) return;
    setDraft(applyDrawing(draft, target));
    setHistory(redo ? { past: [...history.past, drawing(draft)], future: source.slice(0, -1) }
      : { past: source.slice(0, -1), future: [...history.future, drawing(draft)] });
    setNotice(''); setError(''); setVertices([]);
  }
  function camera(value: LayoutCamera) { if (draft && !busy) setDraft({ ...draft, camera: value }); }
  function zoom(factor: number) {
    if (!draft) return;
    const old = draft.camera, next = Math.max(.05, Math.min(8, old.zoom * factor));
    camera({ zoom: next, x: width / 2 - (width / 2 - old.x) / old.zoom * next, y: 240 - (240 - old.y) / old.zoom * next });
  }
  async function save() {
    if (!editable || !draft || !baseline || writing.current) return;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    const local = structuredClone(draft), number = generation.current;
    try {
      const result = await api<{ revision: number }>(path, json('PUT', { expectedRevision: baseline.revision, layout: local, newSectorIds: local.sectors.filter(s => !baseline.layout.sectors.some(old => old.id === s.id)).map(s => s.id) }));
      if (number !== generation.current) return;
      setBaseline({ revision: result.revision, layout: local }); setNotice('Layout salvo.');
      await refresh(); // detalhes cadastrais também passam a mostrar as posições gravadas
      // Histórico do desenho continua útil após salvar; mesas/cabeamento não são recriados.
    } catch (e) { if (number === generation.current) await handleError(e); }
    finally { if (number === generation.current) { writing.current = false; setBusy(false); } }
  }
  async function importBackground(file: File, page: number | null) {
    if (!editable || !draft || writing.current) return false;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    const number = generation.current;
    try {
      const result = await api<{ background: PlanBackground }>(`${base}/plans/${planId}/backgrounds${page ? `?page=${page}` : ''}`, {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file, signal: AbortSignal.timeout(45000),
      });
      if (number !== generation.current) return false;
      const next = structuredClone(draft); next.geometry.background = result.background;
      writing.current = false; commit(next); setVertices([]); setTool('select');
      setDraft({ ...next, camera: fitCamera(drawingBounds(next),width,480) });
      setNotice('Fundo importado. Ajuste alinhamento/escala e use Salvar layout para gravar a troca.'); return true;
    } catch (e) { if (number === generation.current) {
      if (e instanceof ApiError && e.status === 409) setError(e.message);
      else await handleError(e);
    } return false; }
    finally { if (number === generation.current) { writing.current = false; setBusy(false); } }
  }
  async function attachRack() {
    if (!editable || !baseline || dirty || !rackId || writing.current) return;
    writing.current = true; setBusy(true); setError('');
    const number = generation.current;
    try {
      await api(`${base}/plans/${planId}/racks/${rackId}`, json('POST', { expectedRevision: baseline.revision }));
      const latest = await api<Snapshot>(path); await catalog();
      if (number !== generation.current) return;
      setBaseline(latest); setDraft(latest.layout); setHistory(emptyHistory()); setSelected(rackId); setRackId('');
      setNotice('Rack vinculado à planta. Use Posicionar no centro ou os campos para definir seu layout.');
    } catch (e) { if (number === generation.current) await handleError(e); }
    finally { if (number === generation.current) { writing.current = false; setBusy(false); } }
  }
  function centerPosition(): Rectangle {
    return { x: (width / 2 - draft!.camera.x) / draft!.camera.zoom / 80, y: (240 - draft!.camera.y) / draft!.camera.zoom / 80, width: .6, height: 1, rotation: 0 };
  }
  return <section className="plan-editor" aria-label="Editor de planta" aria-busy={busy}>
    <div className="panel-header"><h3>Área de planta</h3><span role="status" className={dirty ? 'badge pending' : 'badge'}>{dirty ? 'Alterações pendentes' : 'Layout sem alterações'}{baseline ? ` · revisão ${baseline.revision}` : ''}</span></div>
    <p className="intro">Medidas em metros; X à direita, Y para baixo e rotação horária. Selecione no desenho ou pela lista.</p>
    {error && <p role="alert" className="error">{error} {draft && (writable ? 'O trabalho local foi preservado.' : 'A visualização local foi mantida.')}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    <div className="plan-toolbar">
      {writable && <><button disabled={!editable || !dirty} onClick={() => void save()}>{busy ? 'Aguarde…' : 'Salvar layout'}</button>
        <button className="secondary" disabled={!editable || !history.past.length} onClick={() => undo()}>Desfazer layout</button>
        <button className="secondary" disabled={!editable || !history.future.length} onClick={() => undo(true)}>Refazer layout</button></>}
      <button className="secondary" disabled={busy} onClick={() => void load()}>Recarregar layout</button>
      {conflict && writable && <button className="secondary" disabled={busy} onClick={() => void load('reconcile')}>Reconciliar posições locais</button>}
    </div>
    {!draft ? <p>{busy ? 'Carregando layout…' : 'Use Recarregar layout para tentar novamente.'}</p> : <>
      <div className="plan-toolbar" aria-label="Navegação da planta">
        <button className="secondary" disabled={busy} aria-pressed={!pan} onClick={() => { setPan(false); setTool('select'); setVertices([]); }}>Selecionar</button>
        <button className="secondary" disabled={busy} aria-pressed={pan} onClick={() => { setPan(true); setTool('select'); setVertices([]); }}>Mover câmera</button>
        <button className="secondary" disabled={busy} onClick={() => zoom(1.25)} aria-label="Aumentar zoom">+</button>
        <output aria-label="Zoom atual">{Math.round(draft.camera.zoom * 100)}%</output>
        <button className="secondary" disabled={busy} onClick={() => zoom(.8)} aria-label="Diminuir zoom">−</button>
        <button className="secondary" disabled={busy} onClick={() => camera(fitCamera(drawingBounds(draft), width, 480))}>Enquadrar objetos</button>
        <button className="secondary" disabled={busy} onClick={() => camera({ ...draft.camera, x: draft.camera.x - 80 })}>Câmera ←</button>
        <button className="secondary" disabled={busy} onClick={() => camera({ ...draft.camera, x: draft.camera.x + 80 })}>Câmera →</button>
        <button className="secondary" disabled={busy} onClick={() => camera({ ...draft.camera, y: draft.camera.y - 80 })}>Câmera ↑</button>
        <button className="secondary" disabled={busy} onClick={() => camera({ ...draft.camera, y: draft.camera.y + 80 })}>Câmera ↓</button>
        <label className="checkbox"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />Grade</label>
        {writable && <label className="checkbox"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />Ajustar à grade (0,25 m)</label>}
      </div>
      {writable && <div className="plan-toolbar" aria-label="Ferramentas de desenho">
        {(['wall', 'door', 'window', 'sector'] as const).map(t => <button key={t} className="secondary" disabled={!editable} aria-pressed={tool === t} onClick={() => { setTool(t); setPan(false); setVertices([]); }}>{({ wall: 'Desenhar parede', door: 'Inserir porta', window: 'Inserir janela', sector: 'Desenhar setor' })[t]}</button>)}
        {tool === 'sector' && <button disabled={!editable || vertices.length < 3} onClick={finishSector}>Concluir setor ({vertices.length} vértices)</button>}
        {(tool !== 'select' || vertices.length > 0) && <button className="secondary" onClick={() => { setTool('select'); setVertices([]); }}>Cancelar desenho</button>}
      </div>}
      {tool !== 'select' && <p role="status">{tool === 'calibrate' ? `Clique em dois pontos no fundo (${vertices.length}/2) e informe a distância real abaixo.` : tool === 'wall' ? 'Clique no início e no fim da parede.' : tool === 'sector' ? 'Clique nos vértices em ordem e use Concluir setor. Não repita o primeiro vértice.' : 'Clique na parede para inserir a abertura.'}</p>}
      <div className="plan-canvas" ref={container} role="img" aria-label="Desenho da planta; lista equivalente e propriedades abaixo">
        <PlanCanvas width={width} height={480} objects={objects} camera={draft.camera} selected={selected} editable={editable && tool === 'select'} interactive={!busy}
          layout={draft} tool={tool} vertices={vertices} drawPoint={drawPoint} editDrawing={commit} backgroundError={setError}
          backgroundUrl={draft.geometry.background ? `/api${base}/plans/${planId}/files/${draft.geometry.background.renderedFileId}` : undefined}
          pan={pan} grid={grid} snap={snap} select={setSelected} change={update} setCamera={camera} />
      </div>
      <p className="intro">Roda do mouse: zoom no cursor. Mover câmera: arraste a área. {writable ? 'Selecione um objeto para arrastar, dimensionar e girar pelas alças ou pelos campos.' : 'Visualização — somente consulta. A câmera pode ser ajustada localmente.'}</p>
      {!objects.length && <p className="empty-state">Cadastre mesas abaixo ou vincule um rack já cadastrado na unidade.</p>}
      <BackgroundPanel key={path} layout={draft} editable={editable} writable={writable} fileBase={`/api${base}/plans/${planId}/files`} importFile={importBackground} change={commit}
        points={tool === 'calibrate' ? vertices : []} pick={() => { setTool('calibrate'); setPan(false); setVertices([]); }} cancel={() => { setTool('select'); setVertices([]); }} />
      <ArchitecturePanel layout={draft} selected={selected} select={setSelected} editable={editable} writable={writable} change={commit} />
      <div className="plan-details">
        <div><h4>Objetos cadastrados na planta</h4><ul className="plan-object-list">{objects.map(item => <li key={item.id}><button className="secondary" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
          {item.kind === 'desks' ? 'Mesa' : 'Rack'}: {item.name}{!item.placement ? ' — sem posição' : ''}</button></li>)}</ul>
          {writable && <div><label htmlFor="layout-rack">Rack cadastrado na unidade</label><select id="layout-rack" disabled={!editable || dirty} value={rackId} onChange={e => setRackId(e.target.value)}>
            <option value="">Selecione um rack sem planta</option>{racks.filter(r => !r.planId).map(r => <option key={r.id} value={r.id}>{park.datacenters.find(dc => dc.id === r.datacenterId)?.name} / {r.name}</option>)}</select>
            <button className="secondary" disabled={!editable || dirty || !rackId} onClick={() => void attachRack()}>Vincular rack à planta</button>
            {dirty && <p>Salve ou recarregue o layout antes de vincular outro rack.</p>}</div>}
        </div>
        <div>{object ? <><h4>{object.kind === 'desks' ? 'Mesa' : 'Rack'}: {object.name}</h4><p className="intro">ID: {object.id}</p>
          {writable && !object.placement && <button disabled={!editable} onClick={() => update(object.id, centerPosition())}>Posicionar no centro</button>}
          {object.placement && <Properties key={object.id} placement={object.placement} editable={editable} writable={writable} change={value => update(object.id, value)} objects={objects.filter(item => item.id !== object.id && item.placement)} />}
          {object.kind === 'desks' && <><label htmlFor="desk-sector">Setor da mesa</label><select id="desk-sector" value={draft.desks.find(d => d.id === object.id)?.sectorId ?? ''} disabled={!editable} onChange={e => {
            const next = structuredClone(draft); next.desks.find(d => d.id === object.id)!.sectorId = e.target.value || null; commit(next);
          }}><option value="">Sem setor</option>{draft.sectors.map(s => <option key={s.id} value={s.id}>{s.name ?? s.id}</option>)}</select></>}
          {writable && object.kind === 'racks' && object.placement && <button className="secondary" disabled={!editable} onClick={() => update(object.id, null)}>Retirar posição do rack</button>}
        </> : <p className="empty-state">Selecione uma mesa ou rack para consultar suas propriedades.</p>}</div>
      </div>
    </>}
  </section>;
}

function Properties({ placement, editable, writable, change, objects }: {
  placement: Rectangle; editable: boolean; writable: boolean; change: (value: Rectangle) => void; objects: CanvasObject[];
}) {
  const [fields, setFields] = useState(placement), [target, setTarget] = useState('');
  useEffect(() => setFields(placement), [placement]);
  const keys = ['x', 'y', 'width', 'height', 'rotation'] as const;
  const labels = { x: 'X (m)', y: 'Y (m)', width: 'Largura (m)', height: 'Profundidade (m)', rotation: 'Rotação (°)' };
  function submit(event: FormEvent) { event.preventDefault(); change({ ...fields, rotation: normalizeRotation(fields.rotation) }); }
  return <form className="plan-properties" onSubmit={submit}>
    <div className="placement-fields">{keys.map(key => <div key={key}><label htmlFor={`layout-${key}`}>{labels[key]}</label><input id={`layout-${key}`} type="number" step="any" required
      min={key === 'width' || key === 'height' ? .05 : undefined} value={Number.isNaN(fields[key]) ? '' : fields[key]} disabled={!editable} onChange={e => setFields({ ...fields, [key]: e.target.valueAsNumber })} /></div>)}</div>
    {writable && <><button type="submit" disabled={!editable}>Aplicar propriedades</button><div className="plan-toolbar">
      <button type="button" className="secondary" disabled={!editable} onClick={() => change({ ...placement, rotation: normalizeRotation(placement.rotation + 90) })}>Girar 90°</button>
      <button type="button" className="secondary" disabled={!editable} onClick={() => change({ ...placement, x: Math.round(placement.x * 4) / 4, y: Math.round(placement.y * 4) / 4 })}>Alinhar à grade</button></div>
      <label htmlFor="layout-align">Alinhar centros com</label><select id="layout-align" value={target} disabled={!editable} onChange={e => setTarget(e.target.value)}><option value="">Selecione outro objeto</option>{objects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className="plan-toolbar">{(['x', 'y'] as const).map(axis => <button key={axis} type="button" className="secondary" disabled={!editable || !objects.some(item => item.id === target)} onClick={() => {
        const other = objects.find(item => item.id === target)?.placement; if (other) change({ ...placement, [axis]: other[axis] });
      }}>Alinhar {axis.toUpperCase()}</button>)}</div></>}
  </form>;
}
