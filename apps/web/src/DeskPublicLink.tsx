import { useEffect, useRef, useState } from 'react';
import { publicDeskUrl, type DeskPublicLink as Link, type PublicLinkAction } from '@topologia-new/domain';
import { api, ApiError, json, message } from './api';
import { deskQr } from './qr';

export function DeskPublicLink({ path, name, checkSession }: { path: string; name: string; checkSession: () => Promise<void> }) {
  const [link, setLink] = useState<Link | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmation, setConfirmation] = useState<PublicLinkAction | null>(null);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null), [qrError, setQrError] = useState('');
  const generation = useRef(0), alert = useRef<HTMLParagraphElement>(null);
  const url = link?.token ? publicDeskUrl(link.origin, link.token) : '';
  const endpoint = `${path}/public-link`;
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  useEffect(() => {
    let active = true;
    setQr(null); setQrError('');
    if (link?.enabled && link.token) void deskQr(link.origin, link.token).then(result => { if (active) setQr(result); })
      .catch(() => { if (active) setQrError('Não foi possível gerar o QR Code. Atualize o endereço e tente novamente.'); });
    return () => { active = false; };
  }, [url, link?.enabled]);
  async function load() {
    const current = ++generation.current;
    setLoading(true); setError(''); setLink(null); setQr(null); setConfirmation(null);
    try { const result = await api<Link>(endpoint); if (current === generation.current) setLink(result); }
    catch (e) { if (current === generation.current) { setError(message(e)); if (e instanceof ApiError && e.status === 401) void checkSession(); } }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => {
    void load();
    const focus = () => { void load(); };
    window.addEventListener('focus', focus);
    return () => { generation.current++; window.removeEventListener('focus', focus); };
  }, [endpoint]);
  async function change(action: PublicLinkAction) {
    if (!link) return;
    const current = ++generation.current;
    setBusy(true); setError(''); setNotice(''); setConfirmation(null); setQr(null);
    try {
      const result = await api<Link>(endpoint, json('PUT', { action, expectedRevision: link.revision }));
      if (current === generation.current) { setLink(result); setNotice(action === 'renew' ? 'Endereço renovado. O anterior foi invalidado; substitua as etiquetas.' : result.enabled ? 'Consulta pública ativada.' : 'Consulta pública desativada.'); }
    } catch (e) {
      if (current === generation.current) { await load(); setError(message(e)); }
    } finally { setBusy(false); }
  }
  return <section className="desk-public-link" aria-label="Endereço público e etiqueta QR" aria-busy={busy || loading}>
    <h4>Endereço público e etiqueta QR</h4>
    <p>Publica somente esta mesa, seus pontos e os destinos. Quem tiver o endereço poderá consultar sem login.</p>
    {loading && <p role="status">Carregando endereço…</p>}
    {error && <p className="error" role="alert" tabIndex={-1} ref={alert}>{error}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    {link && <><p><strong>{link.enabled ? 'Consulta pública ativa' : link.token ? 'Consulta pública desativada' : 'Consulta pública não ativada'}</strong></p>
      <p className="hint">Origem das etiquetas: {link.origin}.</p>
      {url && <label>Endereço da mesa<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>}
      <div className="park-actions">
        <button disabled={busy || loading} onClick={() => link.enabled ? setConfirmation('deactivate') : void change('activate')}>{link.enabled ? 'Desativar consulta pública' : link.token ? 'Reativar consulta pública' : 'Ativar consulta pública'}</button>
        {link.token && <button className="secondary" disabled={busy || loading} onClick={() => setConfirmation('renew')}>Renovar endereço</button>}
        <button className="secondary" disabled={busy || loading} onClick={() => void load()}>Atualizar endereço</button>
      </div>
      {confirmation && <div className="delete-confirm" role="group" aria-label="Confirmar alteração do endereço">
        <p>{confirmation === 'renew' ? 'Renovar invalida o endereço anterior definitivamente. Será necessário substituir as etiquetas. A consulta mantém seu estado ativo ou desativado.' : 'Desativar bloqueia a consulta pública. O mesmo endereço poderá ser reativado depois.'}</p>
        <div className="park-actions"><button disabled={busy} onClick={() => void change(confirmation)}>Confirmar {confirmation === 'renew' ? 'renovação' : 'desativação'}</button>
          <button className="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button></div>
      </div>}
      {link.enabled && <>
        <p className="hint">{new URL(link.origin).hostname === 'localhost' || ['127.0.0.1', '[::1]'].includes(new URL(link.origin).hostname)
          ? 'Endereço local: validado apenas neste computador. Para ler no celular, configure uma origem alcançável pelo aparelho.'
          : 'Confira se esta origem abre no celular antes de distribuir as etiquetas.'}</p>
        {qrError && <p className="error" role="alert">{qrError}</p>}
        {!qr && !qrError && <p role="status">Gerando QR Code…</p>}
        {qr && qr.url === url && <><div className="qr-label" aria-label="Etiqueta da mesa">
          <strong>{name}</strong><img src={qr.image} alt={`QR Code para consultar ${name}`} width={240} height={240} />
          <span>Consultar pontos e destinos</span><small>{qr.url}</small>
        </div><div className="park-actions"><a className="qr-open" href={url} target="_blank" rel="noreferrer">Abrir consulta pública</a>
          <button className="secondary" disabled={busy || loading} onClick={() => window.print()}>Imprimir etiqueta</button></div></>}
      </>}
    </>}
    {!link && !loading && <button className="secondary" onClick={() => void load()}>Tentar novamente</button>}
  </section>;
}
