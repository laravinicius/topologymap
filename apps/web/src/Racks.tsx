import { useEffect, useRef, useState } from 'react';
import { ConnectionPath } from './ConnectionPath';
import type { FormEvent } from 'react';
import { rackLimits, type RackDetail, type RackSummary, type EquipmentDetail, type EquipmentKind, type ParkSnapshot } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { navigatePark } from './Park';
import { RackFront } from './RackFront';
import { RackPortEditor } from './RackPortEditor';
import { ObjectLink } from './ObjectLink';

export function Racks({ path, selected, selectedEquipment, selectedPort, writable, park, refresh, checkSession }: {
  path: string; selected: string; selectedEquipment: string; selectedPort: string; writable: boolean; park: ParkSnapshot;
  refresh: () => Promise<void>; checkSession: () => Promise<void>;
}) {
  const [items, setItems] = useState<RackSummary[]>([]), [rack, setRack] = useState<RackDetail | null>(null), [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [editRack, setEditRack] = useState<RackDetail | 'new' | null>(null), [rackName, setRackName] = useState(''), [capacity, setCapacity] = useState('42');
  const [editEquipment, setEditEquipment] = useState<EquipmentDetail | 'new' | null>(null);
  const [name, setName] = useState(''), [kind, setKind] = useState<EquipmentKind>('generic'), [type, setType] = useState('Servidor');
  const [start, setStart] = useState('1'), [height, setHeight] = useState('1'), [quantity, setQuantity] = useState('24');
  const [portId, setPortId] = useState(''), [portName, setPortName] = useState('');
  const selectedPortId = selectedPort;
  const setSelectedPortId = (id: string) => navigatePark({ porta: id });
  const [confirm, setConfirm] = useState<{ path: string; name: string } | null>(null);
  const active = useRef(true), generation = useRef(0), alert = useRef<HTMLParagraphElement>(null);
  const rackPanel = useRef<HTMLDivElement>(null), equipmentPanel = useRef<HTMLDivElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  function closeForms() { setEditRack(null); setEditEquipment(null); setPortId(''); setConfirm(null); }
  async function load() {
    const current = ++generation.current;
    try {
      const list = await api<{ racks: RackSummary[] }>(path);
      if (!active.current || current !== generation.current) return;
      setItems(list.racks);
      const r = selected ? await api<RackDetail>(`${path}/${selected}`) : null;
      const e = r && selectedEquipment ? await api<EquipmentDetail>(`${path}/${r.id}/equipment/${selectedEquipment}`) : null;
      if (!active.current || current !== generation.current) return;
      setRack(r); setEquipment(e);
    } catch (e) {
      if (!active.current || current !== generation.current) return;
      setRack(null); setEquipment(null); setError(message(e));
      if (e instanceof ApiError && e.status === 401) void checkSession();
    } finally { if (active.current && current === generation.current) setLoading(false); }
  }
  useEffect(() => { setRack(null); setEquipment(null); closeForms(); setError(''); setNotice(''); setLoading(true); void load();
    return () => { generation.current++; };
  }, [path, selected, selectedEquipment]);
  useEffect(() => { void load(); }, [park]);
  useEffect(() => { if (!writable) closeForms(); }, [writable]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  useEffect(() => {
    if (selectedPortId && equipment?.ports.some(p => p.id === selectedPortId)) document.getElementById(`port-${selectedPortId}`)?.focus();
    else if (equipment) equipmentPanel.current?.focus();
    else if (rack) rackPanel.current?.focus();
  }, [rack?.id, equipment?.id, selectedPortId]);
  async function perform(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); if (!active.current) return; closeForms(); setNotice(success); await load(); await refresh(); }
    catch (e) { if (!active.current) return; setError(message(e));
      if (e instanceof ApiError && [401, 403, 404, 409].includes(e.status)) { await load(); await refresh(); }
    } finally { if (active.current) setBusy(false); }
  }
  function openRack(row?: RackDetail) { closeForms(); setEditRack(row ?? 'new'); setRackName(row?.name ?? ''); setCapacity(String(row?.capacityU ?? 42)); setError(''); setNotice(''); }
  function openEquipment(row?: EquipmentDetail) {
    closeForms(); setEditEquipment(row ?? 'new'); setName(row?.name ?? ''); setKind(row?.kind ?? 'generic'); setType(row?.equipmentType ?? 'Servidor');
    setStart(String(row?.startU ?? 1)); setHeight(String(row?.heightU ?? 1)); setQuantity(String(row?.portCount || 24)); setError(''); setNotice('');
  }
  function saveRack(event: FormEvent) {
    event.preventDefault(); const existing = editRack && editRack !== 'new' ? editRack : null;
    void perform(async () => {
      const row = await api<RackDetail>(existing ? `${path}/${existing.id}` : path, json(existing ? 'PATCH' : 'POST', { name: rackName, capacityU: Number(capacity) }));
      if (!existing && active.current) navigatePark({ rack: row.id, equipamento: '' });
    }, 'Rack salvo.');
  }
  function persistEquipment() {
    if (!rack) return;
    const existing = editEquipment && editEquipment !== 'new' ? editEquipment : null;
    void perform(async () => {
      const row = await api<EquipmentDetail>(`${path}/${rack.id}/equipment${existing ? `/${existing.id}` : ''}`, json(existing ? 'PATCH' : 'POST', {
        name, equipmentType: type, startU: Number(start), heightU: Number(height), ...(!existing ? { kind } : {}),
        ...(kind === 'patch_panel' ? { portCount: Number(quantity), ...(existing ? { expectedPortIds: existing.ports.map(p => p.id) } : {}) } : {}),
      }));
      if (!existing && active.current) navigatePark({ equipamento: row.id });
    }, 'Equipamento salvo.');
  }
  function moveEquipment(id: string, startU: number) {
    if (!rack || busy) return;
    void perform(async () => { await api(`${path}/${rack.id}/equipment/${id}`, json('PATCH', { startU })); }, 'Posição do equipamento salva.');
  }
  function editPosition(row: EquipmentDetail) { openEquipment(row); }
  function saveEquipment(event: FormEvent) {
    event.preventDefault();
    if (editEquipment && editEquipment !== 'new' && kind === 'patch_panel' && Number(quantity) < editEquipment.portCount) {
      setConfirm({ path: 'reduce', name: `${editEquipment.portCount - Number(quantity)} última(s) porta(s) de ${editEquipment.name}` }); return;
    }
    persistEquipment();
  }
  const equipmentBase = rack ? `${path}/${rack.id}/equipment` : '';
  return <section className="park-collection" aria-label="Racks" aria-busy={busy || loading}>
    <div className="panel-header"><h3>Racks do datacenter</h3>{writable && <button className="secondary" disabled={busy} onClick={() => openRack()}>Novo rack</button>}</div>
    {error && <p role="alert" className="error" ref={alert} tabIndex={-1}>{error}</p>}{notice && <p role="status" className="success">{notice}</p>}
    {loading && <p role="status">Carregando racks…</p>}
    {!loading && !items.length && <p className="empty-state">Nenhum rack cadastrado neste datacenter.</p>}
    <ul className="park-list">{items.map(r => <li key={r.id}><div className="park-item-name">
      <button className="secondary" aria-label={`Abrir rack ${r.name}`} aria-pressed={selected === r.id} disabled={busy} onClick={() => navigatePark({ rack: r.id, equipamento: '' })}>{r.name}</button>
      <span className="badge">{r.capacityU} U · {r.equipmentCount} equipamentos</span>
    </div></li>)}</ul>
    {rack && <div className="park-detail" ref={rackPanel} tabIndex={-1}>
      <div className="panel-header"><h4>Rack: {rack.name}</h4>{writable && <div className="park-actions">
        <button className="secondary" disabled={busy} onClick={() => openRack(rack)}>Editar rack</button>
        <button className="secondary" disabled={busy} onClick={() => { closeForms(); setConfirm({ path: `${path}/${rack.id}`, name: rack.name }); }}>Excluir rack</button>
        <button disabled={busy} onClick={() => openEquipment()}>Novo equipamento</button>
      </div>}</div>
      <p>Capacidade: {rack.capacityU} U. U inicial e altura definem a ocupação de cada equipamento.</p>
      {rack.planId ? <ObjectLink companyId={park.company.id} kind="rack" id={rack.id} view="plan">Localizar rack na planta</ObjectLink> : <p className="intro">Rack sem planta; consulta completa disponível nesta lista.</p>}
      {selectedPortId && !equipment?.ports.some(p => p.id === selectedPortId) && !loading && <p role="alert" className="error">Porta não encontrada neste equipamento.</p>}
      <RackFront rack={rack} writable={writable} selectedPort={selectedPortId} onSelectPort={(panel, id) => {
        setError(''); setNotice(''); closeForms();
        navigatePark({ equipamento: panel.id, porta: id });
      }} onMove={moveEquipment} onEdit={editPosition} />
      {!rack.equipment.length && <p className="empty-state">Nenhum equipamento neste rack.</p>}
      <ul className="park-list">{rack.equipment.map(e => <li key={e.id}><div className="park-item-name">
        <button className="secondary" disabled={busy} aria-label={`Abrir equipamento ${e.name}`} aria-pressed={selectedEquipment === e.id} onClick={() => navigatePark({ equipamento: e.id })}>{e.name}</button>
        <span>{e.kind === 'patch_panel' ? 'Patch panel' : 'Genérico'} · {e.equipmentType} · U {e.startU} a {e.startU + e.heightU - 1} ({e.heightU} U){e.kind === 'patch_panel' && ` · ${e.portCount} portas`}</span>
      </div></li>)}</ul>
    </div>}
    {equipment && <div className="park-detail" ref={equipmentPanel} tabIndex={-1}>
      <div className="panel-header"><h4>Equipamento: {equipment.name}</h4>{writable && <div className="park-actions">
        <button className="secondary" disabled={busy} onClick={() => openEquipment(equipment)}>Editar equipamento</button>
        <button className="secondary" disabled={busy} onClick={() => { closeForms(); setConfirm({ path: `${equipmentBase}/${equipment.id}`, name: equipment.name }); }}>Excluir equipamento</button>
      </div>}</div>
      <p>{equipment.equipmentType} · U {equipment.startU} a {equipment.startU + equipment.heightU - 1} · {equipment.portCount} portas</p>
      {equipment.kind === 'patch_panel' && !equipment.ports.length && <p className="empty-state">Este patch panel está sem portas. Edite a quantidade para gerar um novo lote.</p>}
      <h5>Lista de portas</h5>
      <ul className="park-list">{equipment.ports.map(p => <li key={p.id} id={`port-${p.id}`} tabIndex={-1} data-selected={selectedPortId === p.id}><div className="park-item-name"><button type="button" className="secondary" aria-pressed={selectedPortId === p.id} onClick={() => setSelectedPortId(p.id)}>{p.name}</button><span className={`badge ${p.connectionId ? 'occupied-port' : 'free-port'}`}>{p.connectionId ? 'Ocupada' : 'Livre'}</span></div>
        <ConnectionPath connection={p.connection} />
        <button type="button" className="secondary" disabled={busy} aria-label={`Consultar porta ${p.name}`} onClick={() => setSelectedPortId(p.id)}>Consultar porta</button>
        {writable && <div className="park-actions"><button className="secondary" disabled={busy} aria-label={`Editar porta ${p.name}`} onClick={() => { closeForms(); setPortId(p.id); setPortName(p.name); setError(''); }}>Editar</button>
          <button className="secondary" disabled={busy} aria-label={`Excluir porta ${p.name}`} onClick={() => { closeForms(); setConfirm({ path: `${equipmentBase}/${equipment.id}/ports/${p.id}`, name: p.name }); }}>Excluir</button></div>}
      </li>)}</ul>
    </div>}
    {rack && selectedPortId && (() => {
      const selectedPort = equipment?.ports.find(item => item.id === selectedPortId);
      return selectedPort ? <RackPortEditor key={selectedPort.id}
        port={selectedPort} writable={writable} park={park} refresh={async () => { await load(); await refresh(); }} checkSession={checkSession}
        close={() => setSelectedPortId('')} saved={async status => { setBusy(false); setSelectedPortId(''); setNotice(status); await load(); }} /> : null;
    })()}
    {writable && editRack && <form aria-label="Cadastro de rack" onSubmit={saveRack}>
      <h4>{editRack === 'new' ? 'Novo rack' : 'Editar rack'}</h4>
      <label htmlFor="rack-name">Nome do rack</label><input id="rack-name" required maxLength={200} pattern=".*\S.*" autoFocus value={rackName} disabled={busy} onChange={e => setRackName(e.target.value)} />
      <label htmlFor="rack-capacity">Capacidade em U</label><input id="rack-capacity" type="number" required min={1} max={rackLimits.units} step={1} value={capacity} disabled={busy} onChange={e => setCapacity(e.target.value)} />
      <p className="intro hint">De 1 a {rackLimits.units} U. Redução só é permitida quando todos os equipamentos cabem na nova capacidade.</p>
      <div className="park-actions"><button disabled={busy}>Salvar rack</button><button type="button" className="secondary" disabled={busy} onClick={closeForms}>Cancelar</button></div>
    </form>}
    {writable && editEquipment && rack && <form aria-label="Cadastro de equipamento" onSubmit={saveEquipment}>
      <h4>{editEquipment === 'new' ? 'Novo equipamento' : 'Editar equipamento'}</h4>
      <label htmlFor="equipment-name">Nome do equipamento</label><input id="equipment-name" required maxLength={200} pattern=".*\S.*" autoFocus value={name} disabled={busy} onChange={e => setName(e.target.value)} />
      <label htmlFor="equipment-kind">Cadastro</label><select id="equipment-kind" disabled={busy || editEquipment !== 'new'} value={kind} onChange={e => { setKind(e.target.value as EquipmentKind); setType(e.target.value === 'patch_panel' ? 'Patch panel' : 'Servidor'); }}><option value="generic">Equipamento genérico</option><option value="patch_panel">Patch panel</option></select>
      <label htmlFor="equipment-type">Tipo do equipamento</label><input id="equipment-type" required maxLength={200} pattern=".*\S.*" value={type} disabled={busy} onChange={e => setType(e.target.value)} />
      <div className="placement-grid"><div><label htmlFor="equipment-start">U inicial</label><input id="equipment-start" type="number" min={1} max={rack.capacityU} step={1} required value={start} disabled={busy} onChange={e => setStart(e.target.value)} /></div>
        <div><label htmlFor="equipment-height">Altura em U</label><input id="equipment-height" type="number" min={1} max={rack.capacityU} step={1} required value={height} disabled={busy} onChange={e => setHeight(e.target.value)} /></div></div>
      <p className="intro hint">Ocupará U {Number(start)} a {Number(start) + Number(height) - 1}, dentro das {rack.capacityU} U do rack. Nenhuma U pode ser compartilhada.</p>
      {kind === 'patch_panel' && <><label htmlFor="equipment-quantity">Quantidade de portas</label><input id="equipment-quantity" type="number" required min={1} max={rackLimits.ports} step={1} value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} aria-describedby="ports-help" />
        <p id="ports-help" className="intro hint">De 1 a {rackLimits.ports}. Porta 1, Porta 2… Ampliar preserva as existentes. Reduzir remove as últimas portas, somente sem conexão e após confirmação.</p></>}
      <div className="park-actions"><button disabled={busy}>Salvar equipamento</button><button type="button" className="secondary" disabled={busy} onClick={closeForms}>Cancelar</button></div>
    </form>}
    {writable && portId && equipment && <form aria-label="Editar porta" onSubmit={event => { event.preventDefault(); void perform(async () => { await api(`${equipmentBase}/${equipment.id}/ports/${portId}`, json('PATCH', { name: portName })); }, 'Porta salva.'); }}>
      <label htmlFor="port-name">Nome da porta</label><input id="port-name" required maxLength={200} pattern=".*\S.*" autoFocus value={portName} disabled={busy} onChange={e => setPortName(e.target.value)} />
      <div className="park-actions"><button disabled={busy}>Salvar porta</button><button type="button" className="secondary" disabled={busy} onClick={closeForms}>Cancelar</button></div>
    </form>}
    {writable && confirm && <div className="delete-confirm" role="group" aria-label="Confirmar remoção">
      <p>Remover <strong>{confirm.name}</strong> definitivamente? A operação só será permitida sem dependências.</p>
      <div className="park-actions"><button disabled={busy} onClick={() => {
        if (confirm.path === 'reduce') persistEquipment();
        else void perform(async () => { await api(confirm.path, { method: 'DELETE' });
          if (!active.current) return;
          if (confirm.path === `${path}/${rack?.id}`) navigatePark({ rack: '', equipamento: '' });
          else if (confirm.path === `${equipmentBase}/${equipment?.id}`) navigatePark({ equipamento: '' });
        }, 'Cadastro removido.');
      }}>Confirmar remoção</button><button className="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar remoção</button></div>
    </div>}
  </section>;
}
