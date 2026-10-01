import { useEffect, useRef, useState } from 'react';
import type { ConnectionDetail, DeskPoint, PortSummary, ParkSnapshot } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { ConnectionPath } from './ConnectionPath';

type PointOption = DeskPoint & { deskName: string; planName: string };

export function RackPortEditor({ port, writable, park, refresh, checkSession, saved, close }: {
  port: PortSummary; writable: boolean; park: ParkSnapshot; refresh: () => Promise<void>; checkSession: () => Promise<void>;
  saved: (notice: string) => Promise<void>; close: () => void;
}) {
  const base = `/companies/${park.company.id}`;
  const [points, setPoints] = useState<PointOption[]>([]), [pointId, setPointId] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'transfer' | 'unlink' | null>(null);
  const [error, setError] = useState(''), [stale, setStale] = useState(false);
  const active = useRef(true), writing = useRef(false), alert = useRef<HTMLParagraphElement>(null);
  const originalRef = useRef(port.connection), original = originalRef.current;
  const writableRef = useRef(writable);
  writableRef.current = writable;
  const point = points.find(item => item.id === pointId);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (error || stale) alert.current?.focus(); }, [error, stale]);
  useEffect(() => {
    let live = true;
    if (!writable) {
      setPoints([]); setPointId(''); setConfirm(null); setLoading(false);
      return;
    }
    setLoading(true);
    void api<{ points: PointOption[] }>(`${base}/points`).then(result => { if (live) setPoints(result.points); }).catch(e => {
      if (!live) return; setError(message(e)); if (e instanceof ApiError && e.status === 401) void checkSession();
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [base, writable]);
  async function revalidate() {
    const [currentPort, list] = await Promise.all([
      api<{ portId: string; connection: ConnectionDetail | null }>(`${base}/ports/${port.id}/connection`),
      writableRef.current ? api<{ points: PointOption[] }>(`${base}/points`) : Promise.resolve(null),
    ]);
    if (!active.current) return currentPort.connection;
    if (writableRef.current && list) setPoints(list.points);
    if (writableRef.current && ((currentPort.connection?.id ?? null) !== (original?.id ?? null) || currentPort.connection?.revision !== original?.revision)) setStale(true);
    await refresh();
    return currentPort.connection;
  }
  async function write(mode: 'associate' | 'transfer' | 'unlink') {
    if (!writableRef.current || !active.current || writing.current || stale || busy || (mode !== 'unlink' && !point)) return;
    if (mode !== 'associate' && !original) return;
    writing.current = true; setBusy(true); setError('');
    try {
      const [state, endpoint] = await Promise.all([
        api<{ portId: string; connection: ConnectionDetail | null }>(`${base}/ports/${port.id}/connection`),
        mode === 'unlink' ? Promise.resolve(null) : api<{ pointId: string; connection: ConnectionDetail | null }>(`${base}/points/${point!.id}/connection`),
      ]);
      if (!active.current || !writableRef.current) return;
      if ((state.connection?.id ?? null) !== (original?.id ?? null) || state.connection?.revision !== original?.revision || (endpoint && endpoint.connection)) {
        setStale(true); setError('A porta ou o ponto mudou em outra sessão. Confira o estado atualizado e abra uma nova ação.');
        await revalidate(); return;
      }
      if (mode === 'associate') await api<ConnectionDetail>(`${base}/connections`, json('POST', { pointId: point!.id, portId: port.id }));
      else if (mode === 'transfer') await api<ConnectionDetail>(`${base}/connections/${original!.id}/transfer`, json('POST', {
        pointId: point!.id, portId: port.id, expected: { pointId: original!.pointId, portId: original!.portId, revision: original!.revision },
      }));
      else await api(`${base}/connections/${original!.id}`, json('DELETE', { expected: { pointId: original!.pointId, portId: original!.portId, revision: original!.revision } }));
      await revalidate();
      if (active.current) await saved(mode === 'associate' ? 'Ponto associado pela porta. Mesa e rack atualizados.' : mode === 'transfer' ? 'Ponto transferido para esta porta. Mesa e rack atualizados.' : 'Conexão removida. Mesa e porta atualizadas.');
    } catch (e) {
      if (!active.current) return;
      setConfirm(null); setStale(true);
      setError(e instanceof ApiError && e.status === 409 ? 'Conflito com outra sessão: o ponto ou a porta foi alterado. Atualize e abra uma nova ação.' : message(e));
      try {
        if (e instanceof ApiError && e.status === 403) await refresh();
        await revalidate();
      } catch { setError(previous => `${previous} Não foi possível atualizar as extremidades. Use Atualizar acessos.`); }
      if (e instanceof ApiError && e.status === 401) void checkSession();
    } finally { writing.current = false; if (active.current) setBusy(false); }
  }
  const occupied = !!original;
  return <section className="park-detail connection-editor" aria-label={`Porta ${port.name}`} aria-busy={busy || loading}>
    <div className="panel-header"><h4>{port.name} · {port.connection ? 'Ocupada' : 'Livre'}</h4><button type="button" className="secondary" disabled={busy} onClick={close}>Fechar porta</button></div>
    <ConnectionPath connection={port.connection} />
    {(error || (writable && stale)) && <p ref={alert} tabIndex={-1} role="alert" className="error">{error || 'A conexão desta porta mudou. Confira os dados atuais e selecione a porta novamente.'}</p>}
    {writable && loading && <p role="status">Carregando pontos da empresa…</p>}{busy && <p role="status">Gravando e atualizando mesa e porta…</p>}
    {writable && !loading && <>
      <p>Selecione um ponto livre para associar a esta porta. Uma porta ocupada pode transferir seu vínculo para outro ponto livre.</p>
      <label htmlFor="rack-port-point">Ponto da mesa</label>
      <select id="rack-port-point" autoFocus value={pointId} disabled={busy || stale} onChange={event => { setPointId(event.target.value); setConfirm(null); setError(''); }}>
        <option value="">Selecione um ponto livre</option>
        {points.filter(item => !item.connectionId || item.id === original?.pointId).map(item => <option key={item.id} value={item.id} disabled={item.id === original?.pointId}>{item.deskName} / {item.planName} · {item.name}{item.connectionId ? ' · já conectado a esta porta' : ' · livre'}</option>)}
      </select>
      {occupied ? <div className="park-actions"><button disabled={busy || loading || stale || !point || point.id === original?.pointId} onClick={() => setConfirm('transfer')}>Revisar transferência do vínculo</button>
        <button className="secondary" disabled={busy || stale} onClick={() => setConfirm('unlink')}>Revisar desvinculação</button></div>
        : <button disabled={busy || loading || stale || !point} onClick={() => void write('associate')}>Associar ponto nesta porta</button>}
    </>}
    {writable && confirm && !stale && <div className="delete-confirm" role="group" aria-label="Confirmar alteração da porta">
      <p>{confirm === 'transfer' ? `Transferir o vínculo desta porta para ${point?.deskName} / ${point?.planName} / ${point?.name}?` : `Desvincular ${original?.path.origin.point.name} desta porta?`}</p>
      <div className="park-actions"><button disabled={busy || (confirm === 'transfer' && !point)} onClick={() => void write(confirm)}>{confirm === 'transfer' ? 'Confirmar transferência' : 'Confirmar desvinculação'}</button>
        <button className="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar alteração</button></div>
    </div>}
    <div className="park-actions"><button type="button" className="secondary" disabled={busy} onClick={() => { setStale(false); setError(''); void revalidate().catch(e => setError(message(e))); }}>{writable ? 'Atualizar porta e pontos' : 'Atualizar porta'}</button></div>
  </section>;
}
