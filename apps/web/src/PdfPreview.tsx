import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPreview({ file, page, selectPage, ready }: {
  file: File; page: number; selectPage: (page: number) => void; ready: (valid: boolean) => void;
}) {
  const [pdf,setPdf] = useState<PDFDocumentProxy | null>(null), [error,setError] = useState(''), [rendering,setRendering] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    setPdf(null); setError(''); setRendering(true); ready(false);
    let task: PDFDocumentLoadingTask | undefined;
    void file.arrayBuffer().then(data => {
      if (!active) return;
      task = getDocument({ data: new Uint8Array(data), useSystemFonts: false, maxImageSize: 16000000,
        standardFontDataUrl: '/pdfjs/standard_fonts/', cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, wasmUrl: '/pdfjs/wasm/' });
      return task.promise;
    }).then(document => {
      if (!document) return;
      if (!active) return;
      if (document.numPages > 100) { setError('PDF deve ter até 100 páginas.'); return; }
      setPdf(document);
    }).catch(() => { if (active) setError('PDF inválido ou protegido por senha.'); });
    return () => { active = false; void task?.destroy(); };
  }, [file,ready]);
  useEffect(() => {
    if (!pdf) return;
    let active = true, render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true); ready(false); setError('');
    void pdf.getPage(page).then(selected => {
      if (!active || !canvas.current) return;
      const source = selected.getViewport({ scale: 1 });
      if (Math.min(source.width,source.height) <= 0 || Math.max(source.width,source.height) > 14400) throw new Error('Dimensões inválidas.');
      const viewport = selected.getViewport({ scale: Math.min(1,900/Math.max(source.width,source.height)) });
      canvas.current.width = Math.max(1,Math.floor(viewport.width)); canvas.current.height = Math.max(1,Math.floor(viewport.height));
      render = selected.render({ canvas: canvas.current, viewport });
      return render.promise;
    }).then(() => { if (active) { setRendering(false); ready(true); } }).catch(() => { if (active) { setError('Não foi possível renderizar a página.'); setRendering(false); } });
    return () => { active = false; render?.cancel(); };
  }, [pdf,page,ready]);
  return <div className="pdf-preview">
    {pdf && <><label htmlFor="background-page">Página do PDF ({pdf.numPages} páginas)</label><select id="background-page" value={page} onChange={e => selectPage(Number(e.target.value))}>
      {Array.from({ length: pdf.numPages },(_,i) => <option key={i+1} value={i+1}>Página {i+1}</option>)}</select></>}
    {error ? <p role="alert" className="error">{error}</p> : rendering && <p role="status">Preparando prévia da página…</p>}
    <canvas ref={canvas} aria-label={`Prévia da página ${page}`} />
  </div>;
}
