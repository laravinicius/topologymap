import { useEffect, useRef, useState } from 'react';
import type { ConnectionDetail, DeskPoint, EquipmentDetail, ParkSnapshot, PointConnection, PortConnection, RackDetail, RackSummary } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { ConnectionPath } from './ConnectionPath';

export type ConnectionAction = { point: DeskPoint; mode: 'associate' | 'transfer' | 'unlink' };

/** A leitura que abriu a ação é preservada até a confirmação; nunca trocar a revisão silenciosamente. */
export function DeskConnectionEditor({ action, current, park, refresh, checkSession, close, saved, onBusy }: {
  action: ConnectionAction; current: DeskPoint | undefined; park: ParkSnapshot;
  refresh: () => Promise<void>; checkSession: () => Promise<void>; close: () => void;
  saved: (notice: string) => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const original = action.point.connection;
  const base = `/companies/${park.company.id}`;
  const [dcId, setDcId] = useState(original?.path.destination.datacenter.id ?? '');
  const [rackId, setRackId] = useState(original?.path.destination.rack.id ?? '');
  const [panelId, setPanelId] = useState(original?.path.destination.patchPanel.id ?? '');
  const [portId, setPortId] = useState('');
  const [racks, setRacks] = useState<RackSummary[]>([]), [rack, setRack] = useState<RackDetail | null>(null);
  const [panel, setPanel] = useState<EquipmentDetail | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [invalid, setInvalid] = useState(false);
  const [confirmation, setConfirmation] = useState(false), [reload, setReload] = useState(0);
  const generation = useRef(0), active = useRef(true), writing = useRef(false), alert = useRef<HTMLParagraphElement>(null);
  const dc = park.datacenters.find(d => d.id === dcId);
  const rackBase = dc ? `${base}/units/${dc.unitId}/datacenters/${dc.id}/racks` : '';
  const selectedPort = panel?.ports.find(p => p.id === portId);
  const changed = !current || (current.connection?.id ?? null) !== (original?.id ?? null)
    || current.connection?.revision !== original?.revision;
  const stale = invalid || changed;
  const destinationValid = !!dc && !!rack && rack.id === rackId && !!panel && panel.id === panelId
    && !!selectedPort && !selectedPort.connectionId;
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  useEffect(() => { if (error || stale) alert.current?.focus(); }, [error, stale]);
  useEffect(() => {
    const version = ++generation.current;
    setLoading(true); setConfirmation(false);
    async function load() {
      try {
        const list = dc ? await api<{ racks: RackSummary[] }>(rackBase) : { racks: [] };
        const detail = dc && list.racks.some(r => r.id === rackId) ? await api<RackDetail>(`${rackBase}/${rackId}`) : null;
        const equipment = detail?.equipment.some(e => e.id === panelId && e.kind === 'patch_panel')
          ? await api<EquipmentDetail>(`${rackBase}/${rackId}/equipment/${panelId}`) : null;
        if (!active.current || version !== generation.current) return;
        setRacks(list.racks); setRack(detail); setPanel(equipment);
        if (!detail) { setRackId(''); setPanelId(''); setPortId(''); }
        else if (!equipment) { setPanelId(''); setPortId(''); }
        else if (!equipment.ports.some(p => p.id === portId)) setPortId('');
      } catch (e) {
        if (!active.current || version !== generation.current) return;
        setRacks([]); setRack(null); setPanel(null); setError(message(e));
        if (e instanceof ApiError && e.status === 401) void checkSession();
      } finally { if (active.current && version === generation.current) setLoading(false); }
    }
    if (action.mode !== 'unlink') void load(); else setLoading(false);
    return () => { generation.current++; };
    // Revalidar destinos no mesmo ciclo de foco/intervalo/atualização do parque.
  }, [rackBase, rackId, panelId, park, reload, action.mode]);

  async function revalidateEndpoints(target: string) {
    const ports = [...new Set([original?.portId, target].filter((id): id is string => !!id))];
    const results = await Promise.allSettled([
      api<PointConnection>(`${base}/points/${action.point.id}/connection`),
      ...ports.map(id => api<PortConnection>(`${base}/ports/${id}/connection`)),
    ]);
    // Outra sessão pode ter transferido para uma porta diferente das duas conhecidas.
    const point = results[0];
    const actualPort = point?.status === 'fulfilled' ? point.value.connection?.portId : null;
    if (actualPort && !ports.includes(actualPort)) results.push(...await Promise.allSettled([api<PortConnection>(`${base}/ports/${actualPort}/connection`)]));
    // Uma extremidade removida também exige reler os cadastros. Demais falhas precisam ser visíveis.
    const failed = results.find(r => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.status === 404));
    await refresh();
    if (failed?.status === 'rejected') throw failed.reason;
  }
  async function write() {
    if (writing.current || stale || (action.mode !== 'unlink' && (!destinationValid || loading))) return;
    if (action.mode !== 'associate' && (!original || !confirmation)) return;
    writing.current = true; setBusy(true); onBusy(true); setError('');
    const target = portId;
    let committed = false;
    try {
      const expected = original ? { pointId: original.pointId, portId: original.portId, revision: original.revision } : null;
      if (action.mode === 'associate') await api<ConnectionDetail>(`${base}/connections`, json('POST', { pointId: action.point.id, portId: target }));
      else if (action.mode === 'transfer') await api<ConnectionDetail>(`${base}/connections/${original!.id}/transfer`, json('POST', { pointId: action.point.id, portId: target, expected }));
      else await api(`${base}/connections/${original!.id}`, json('DELETE', { expected }));
      committed = true;
      await revalidateEndpoints(target);
      if (active.current) await saved(action.mode === 'associate' ? 'Ponto associado. Mesa e portas atualizadas.' : action.mode === 'transfer' ? 'Conexão transferida. A porta anterior foi liberada.' : 'Conexão desvinculada. Ponto e porta foram liberados.');
    } catch (e) {
      if (!active.current) return;
      setConfirmation(false);
      const conflict = e instanceof ApiError && e.status === 409;
      // Falha de rede pode ter ocorrido após o COMMIT; proibir repetição automática também nesse caso.
      setInvalid(true);
      setError(committed ? 'A gravação foi concluída, mas a atualização falhou. Atualize a consulta antes de continuar.'
        : conflict ? 'Conflito com outra sessão: ponto ou porta foi alterado. Confira o estado atualizado e abra uma nova ação.' : message(e));
      try { await revalidateEndpoints(target); } catch { setError(previous => `${previous} Não foi possível atualizar todas as extremidades. Use Atualizar acessos.`); }
      if (e instanceof ApiError && e.status === 401) void checkSession();
      if (active.current) setReload(n => n + 1);
    } finally { writing.current = false; if (active.current) { setBusy(false); onBusy(false); } }
  }
  const title = action.mode === 'associate' ? 'Associar ponto' : action.mode === 'transfer' ? 'Transferir conexão' : 'Desvincular conexão';
  return <section className="park-detail connection-editor" aria-label={title} aria-busy={busy || loading}>
    <h4>{title}: {action.point.name}</h4>
    <ConnectionPath connection={original} />
    {(error || stale) && <div><p ref={alert} tabIndex={-1} role="alert" className="error">{error || 'A conexão deste ponto mudou em outra sessão. Confira o estado atualizado e abra uma nova ação.'}</p>
      <p>Estado atual de {current?.name ?? action.point.name}: {current?.connection ? 'Associado' : current ? 'Não associado' : 'Ponto indisponível'}.</p><ConnectionPath connection={current?.connection ?? null} /></div>}
    {loading && <p role="status">Carregando destinos e ocupação das portas…</p>}
    {busy && <p role="status">Gravando e atualizando as extremidades…</p>}
    {action.mode !== 'unlink' && <form aria-label="Selecionar destino" onSubmit={e => { e.preventDefault(); if (busy || loading || stale || !destinationValid) return; if (action.mode === 'associate') void write(); else setConfirmation(true); }}>
      <fieldset disabled={busy || stale}><legend>Destino do ponto</legend>
        <label htmlFor="connection-dc">Datacenter</label><select id="connection-dc" autoFocus value={dc?.id ?? ''} onChange={e => { setDcId(e.target.value); setRackId(''); setPanelId(''); setPortId(''); setRacks([]); setRack(null); setPanel(null); setError(''); }}>
          <option value="">Selecione um datacenter</option>{park.datacenters.map(d => <option key={d.id} value={d.id}>{park.units.find(u => u.id === d.unitId)?.name} / {d.name}</option>)}
        </select>
        {!park.datacenters.length && <p>Nenhum datacenter cadastrado nesta empresa.</p>}
        <label htmlFor="connection-rack">Rack</label><select id="connection-rack" value={rackId} disabled={!dc || loading} onChange={e => { setRackId(e.target.value); setPanelId(''); setPortId(''); setRack(null); setPanel(null); }}>
          <option value="">Selecione um rack</option>{racks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>{dc && !loading && !racks.length && <p>Nenhum rack neste datacenter.</p>}
        <label htmlFor="connection-panel">Patch panel</label><select id="connection-panel" value={panelId} disabled={!rack || loading} onChange={e => { setPanelId(e.target.value); setPortId(''); setPanel(null); }}>
          <option value="">Selecione um patch panel</option>{rack?.equipment.filter(e => e.kind === 'patch_panel').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>{rack && !loading && !rack.equipment.some(e => e.kind === 'patch_panel') && <p>Nenhum patch panel neste rack.</p>}
        <label htmlFor="connection-port">Porta</label><select id="connection-port" value={portId} disabled={!panel || loading} required onChange={e => { setPortId(e.target.value); setConfirmation(false); }}>
          <option value="">Selecione uma porta livre</option>{panel?.ports.map(p => <option key={p.id} value={p.id} disabled={!!p.connectionId}>{p.name} — {p.connectionId ? `Ocupada: ${p.connection?.path.origin.desk.name} / ${p.connection?.path.origin.point.name}` : 'Livre'}</option>)}
        </select>
        {panel && <p>Portas livres: {panel.ports.filter(p => !p.connectionId).length} · ocupadas: {panel.ports.filter(p => p.connectionId).length}. Portas ocupadas não podem ser substituídas.</p>}
        {dc && <p aria-label="Destino selecionado">Destino selecionado: {park.units.find(u => u.id === dc.unitId)?.name} / {dc.name}{rack && ` / ${rack.name}`}{panel && ` / ${panel.name}`}{selectedPort && ` / ${selectedPort.name}`}</p>}
      </fieldset>
      <button type="submit" disabled={busy || loading || stale || !destinationValid}>{action.mode === 'associate' ? 'Confirmar associação' : 'Revisar transferência'}</button>
    </form>}
    {action.mode === 'unlink' && !confirmation && <button disabled={busy || stale} onClick={() => setConfirmation(true)}>Revisar desvinculação</button>}
    {confirmation && !stale && <div className="delete-confirm" role="group" aria-label="Confirmar alteração da conexão">
      <p>{action.mode === 'unlink' ? 'Desvincular este ponto e liberar a porta indicada acima?' : `Transferir ${action.point.name} para ${dc?.name} / ${rack?.name} / ${panel?.name} / ${selectedPort?.name}? A porta anterior será liberada.`}</p>
      <div className="park-actions"><button disabled={busy || loading || (action.mode !== 'unlink' && !destinationValid)} onClick={() => void write()}>{action.mode === 'unlink' ? 'Confirmar desvinculação' : 'Confirmar transferência'}</button><button className="secondary" disabled={busy} onClick={() => setConfirmation(false)}>Cancelar alteração</button></div>
    </div>}
    <div className="park-actions"><button className="secondary" disabled={busy || loading} onClick={() => { setReload(n => n + 1); void refresh(); }}>Atualizar destinos</button><button className="secondary" disabled={busy} onClick={close}>{stale ? 'Fechar e revisar ponto' : 'Cancelar conexão'}</button></div>
  </section>;
}
