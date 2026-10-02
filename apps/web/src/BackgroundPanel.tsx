import { lazy, Suspense, useEffect, useState } from 'react';
import type { PlanBackground, PlanLayout, Position } from '@topologia-new/domain';
import { calibrateBackground, worldToSource } from './background';
const PdfPreview = lazy(() => import('./PdfPreview'));

export function BackgroundPanel({ layout, editable, writable, fileBase, importFile, change, points, pick, cancel }: {
  layout: PlanLayout; editable: boolean; writable: boolean; fileBase: string;
  importFile: (file: File,page: number | null) => Promise<boolean>; change: (next: PlanLayout) => void;
  points: Position[]; pick: () => void; cancel: () => void;
}) {
  const b = layout.geometry.background;
  const [file,setFile] = useState<File | null>(null), [page,setPage] = useState(1), [ready,setReady] = useState(false), [uploading,setUploading] = useState(false);
  const [error,setError] = useState(''), [fields,setFields] = useState(b?.placement), [distance,setDistance] = useState(1);
  const [source,setSource] = useState<Position[]>([{ x: 0,y: 0 },{ x: 0,y: 0 }]);
  useEffect(() => { setFields(b?.placement); },[b]);
  useEffect(() => { if (b && points.length) setSource([0,1].map(i => points[i] ? worldToSource(b,points[i]!) : { x: 0,y: 0 })); },[points,b]);
  function apply(background?: PlanBackground) { const next = structuredClone(layout); if (background) next.geometry.background = background; else delete next.geometry.background; change(next); }
  return <section className="background-panel" aria-label="Fundo da planta"><h4>Fundo da planta</h4>
    <p className="intro">{writable ? 'PNG/JPG/PDF até 20 MiB. Imagens: até 8192 px por lado e 16 milhões de pixels. PDF: até 100 páginas. O fundo tem escala própria; mesas e conexões mantêm suas posições.' : b ? 'Fundo da planta disponível para consulta e download.' : 'Esta planta não possui fundo importado.'}</p>
    {writable && <><label htmlFor="background-file">Importar ou trocar fundo</label><input id="background-file" type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" disabled={!editable || uploading} onChange={e => {
      const next = e.target.files?.[0] ?? null; e.target.value = ''; setError(''); setReady(false); setPage(1); setFile(null);
      if (!next) return;
      if (!next.size || next.size > 20*1024*1024 || !['image/png','image/jpeg','application/pdf'].includes(next.type)) { setError('Escolha PNG, JPG ou PDF até 20 MiB.'); return; }
      setFile(next); if (next.type !== 'application/pdf') setReady(true);
    }} />
    {file && <><p>{file.name}</p>{file.type === 'application/pdf' && <Suspense fallback={<p role="status">Carregando PDF.js…</p>}><PdfPreview file={file} page={page} selectPage={setPage} ready={setReady} /></Suspense>}
      <button disabled={!editable || !ready || uploading} onClick={async () => {
        setUploading(true); setError('');
        try { if (await importFile(file,file.type === 'application/pdf' ? page : null)) setFile(null); }
        finally { setUploading(false); }
      }}>{uploading ? 'Importando e validando…' : 'Usar como fundo'}</button></>}
    </>}
    {error && <p role="alert" className="error">{error}</p>}
    {b && <><p>{b.page ? `PDF — página ${b.page}` : 'Imagem'} · {b.sourceWidthPx} × {b.sourceHeightPx} px</p>
      <div className="plan-toolbar"><a href={`${fileBase}/${b.originalFileId}`} download>Baixar original</a><a href={`${fileBase}/${b.renderedFileId}`} download>Baixar fundo renderizado</a></div>
      {fields && <form onSubmit={e => { e.preventDefault(); apply({ ...b, placement: fields }); }}>
        <div className="placement-fields">{(['x','y','width','height','rotation'] as const).map(key => <div key={key}><label htmlFor={`background-${key}`}>{({ x:'Centro X (m)',y:'Centro Y (m)',width:'Largura do fundo (m)',height:'Altura do fundo (m)',rotation:'Rotação do fundo (°)' })[key]}</label>
          <input id={`background-${key}`} type="number" step="any" required value={Number.isNaN(fields[key]) ? '' : fields[key]} disabled={!editable} min={key === 'width' || key === 'height' ? .001 : key === 'rotation' ? 0 : -1000000} max={key === 'rotation' ? 359.9999 : key === 'width' || key === 'height' ? 10000 : 1000000} onChange={e => setFields({ ...fields,[key]:e.target.valueAsNumber })} /></div>)}</div>
        {writable && <div className="plan-toolbar"><button disabled={!editable}>Aplicar alinhamento do fundo</button><button type="button" className="secondary" disabled={!editable} onClick={() => apply({ ...b,placement:{ ...b.placement,x:0,y:0 } })}>Centralizar na origem</button></div>}
      </form>}
      <label htmlFor="background-opacity">Opacidade do fundo ({Math.round((b.opacity ?? 1)*100)}%)</label><input id="background-opacity" type="range" min="0" max="1" step="0.05" value={b.opacity ?? 1} disabled={!editable} onChange={e => apply({ ...b,opacity:Number(e.target.value) })} />
      {writable && <><h5>Calibrar por distância conhecida</h5><p>Escolha dois pontos no fundo ou informe os pixels medidos a partir do canto superior esquerdo. O primeiro ponto ficará no lugar.</p>
        <div className="plan-toolbar"><button className="secondary" disabled={!editable} onClick={pick}>Marcar dois pontos no fundo</button><button className="secondary" disabled={!editable} onClick={cancel}>Cancelar calibração</button></div>
        <form onSubmit={e => { e.preventDefault(); setError(''); try { apply(calibrateBackground(b,source[0]!,source[1]!,distance)); cancel(); } catch (e) { setError((e as Error).message); } }}>
          <div className="placement-fields">{source.map((p,i) => (['x','y'] as const).map(axis => <div key={`${i}${axis}`}><label htmlFor={`calibration-${i}-${axis}`}>Ponto {i+1} {axis.toUpperCase()} (px)</label><input id={`calibration-${i}-${axis}`} type="number" step="any" min="0" max={axis === 'x' ? b.sourceWidthPx : b.sourceHeightPx} value={Number.isNaN(p[axis]) ? '' : p[axis]} required disabled={!editable} onChange={e => setSource(source.map((old,n) => n === i ? { ...old,[axis]:e.target.valueAsNumber } : old))} /></div>))}
          <div><label htmlFor="calibration-distance">Distância real (m)</label><input id="calibration-distance" type="number" min="0.001" max="10000" step="any" value={distance} required disabled={!editable} onChange={e => setDistance(e.target.valueAsNumber)} /></div></div>
          <button disabled={!editable}>Aplicar calibração</button>
        </form><button className="danger" disabled={!editable} onClick={() => { apply(); cancel(); }}>Remover fundo</button></>}
    </>}
  </section>;
}
