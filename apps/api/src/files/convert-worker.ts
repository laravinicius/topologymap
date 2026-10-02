import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const { bytes, mediaType, page } = workerData as { bytes: Uint8Array; mediaType: string; page: number | null };
const pixels = 16000000;
async function convert() {
  if (mediaType !== 'application/pdf') {
    const image = sharp(bytes, { limitInputPixels: pixels, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    if (!['png','jpeg'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1
      || !metadata.width || !metadata.height || Math.max(metadata.width,metadata.height) > 8192)
      throw new Error('Imagem inválida, animada ou excede 8192 px / 16 milhões de pixels.');
    if (`image/${metadata.format === 'jpeg' ? 'jpeg' : 'png'}` !== mediaType) throw new Error('Tipo declarado não corresponde à imagem.');
    const result = await image.rotate().png().toBuffer({ resolveWithObject: true });
    return { png: result.data, width: result.info.width, height: result.info.height };
  }
  const base = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const task = getDocument({ data: bytes, useSystemFonts: false,
    standardFontDataUrl: join(base,'standard_fonts/'), cMapUrl: join(base,'cmaps/'), cMapPacked: true,
    wasmUrl: join(base,'wasm/'), stopAtErrors: true, maxImageSize: pixels });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100 || !page || page > pdf.numPages) throw new Error('PDF deve ter até 100 páginas; escolha uma página existente.');
    const selected = await pdf.getPage(page), source = selected.getViewport({ scale: 1 });
    if (!Number.isFinite(source.width) || !Number.isFinite(source.height) || Math.min(source.width,source.height) <= 0
      || Math.max(source.width,source.height) > 14400) throw new Error('Dimensões da página PDF inválidas (máximo 14400 pt).');
    const viewport = selected.getViewport({ scale: Math.min(1.5,4096/Math.max(source.width,source.height),Math.sqrt(pixels/(source.width*source.height))) });
    const width = Math.floor(viewport.width), height = Math.floor(viewport.height);
    if (!width || !height) throw new Error('Página PDF sem dimensões renderizáveis.');
    const canvas = createCanvas(width,height);
    await selected.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise;
    return { png: canvas.toBuffer('image/png'), width, height };
  } finally { await task.destroy(); }
}
try { parentPort!.postMessage(await convert()); }
catch (e) { parentPort!.postMessage({ error: e instanceof Error && e.name === 'PasswordException' ? 'PDF protegido por senha não é suportado.' : 'Arquivo inválido ou fora dos limites. PNG/JPG: 8192 px e 16 milhões de pixels; PDF: até 100 páginas e 14400 pt por lado.' }); }
