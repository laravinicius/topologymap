import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { PlanBackground } from '@topologia-new/domain';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, unlink, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { HttpError, companyAccess } from '../auth/authorization.js';

const maximum = 20 * 1024 * 1024;
const uuid = { type: 'string', format: 'uuid' };
const params = { type: 'object', additionalProperties: false, required: ['companyId','planId'], properties: { companyId: uuid, planId: uuid } };
type Params = { companyId: string; planId: string };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const filePath = (root: string, id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404,'Arquivo não encontrado.');
  return join(root,id); // Somente IDs gerados pelo servidor/banco, nunca nomes do cliente.
};
async function convert(bytes: Buffer, mediaType: string, page: number | null): Promise<{ png: Buffer; width: number; height: number }> {
  const worker = new Worker(new URL(import.meta.url.endsWith('.ts') ? './convert-worker.ts' : './convert-worker.js',import.meta.url), {
    workerData: { bytes: new Uint8Array(bytes), mediaType, page }, resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  return new Promise((accept,reject) => {
    const timer = setTimeout(() => { reject(new HttpError(400,'Conversão excedeu 30 segundos. Simplifique o arquivo.')); void worker.terminate(); },30000);
    worker.once('message', result => {
      clearTimeout(timer); void worker.terminate();
      if (result.error) reject(new HttpError(400,result.error));
      else accept({ ...result, png: Buffer.from(result.png) });
    });
    worker.once('error', () => { clearTimeout(timer); reject(new HttpError(400,'Não foi possível converter o arquivo dentro dos limites.')); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new HttpError(400,'Conversão interrompida.')); });
  });
}

export function registerFiles(app: FastifyInstance, pool: pg.Pool, directory = process.env.FILES_DIR ?? '/data/files') {
  const root = resolve(directory);
  let converting = false;
  // Upload binário evita base64, nomes e partes multipart ambiguamente interpretadas.
  app.addContentTypeParser(['image/png','image/jpeg','application/pdf'], { parseAs: 'buffer', bodyLimit: maximum }, (_req,body,done) => done(null,body));
  app.post<{ Params: Params; Querystring: { page?: string }; Body: Buffer }>('/api/companies/:companyId/plans/:planId/backgrounds', {
    config: { access: 'company' }, bodyLimit: maximum,
    schema: { params, querystring: { type: 'object', additionalProperties: false, properties: { page: { type: 'string', pattern: '^[1-9][0-9]?$|^100$' } } } },
    preParsing: async request => {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request.params.companyId))
        throw new HttpError(400,'ID de empresa inválido.');
      await companyAccess(pool,request,request.params.companyId);
    },
  }, async (request,reply) => {
    if (!Buffer.isBuffer(request.body) || !request.body.length) throw new HttpError(400,'Envie um arquivo PNG, JPG ou PDF, até 20 MiB.');
    const type = request.headers['content-type']?.split(';')[0];
    const bytes = request.body;
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const pdf = bytes.subarray(0,5).toString() === '%PDF-';
    if (!((type === 'image/png' && png) || (type === 'image/jpeg' && jpeg) || (type === 'application/pdf' && pdf)))
      throw new HttpError(400,'Conteúdo não corresponde a PNG, JPG ou PDF.');
    const page = request.query.page ? Number(request.query.page) : null;
    if ((pdf && !page) || (!pdf && page !== null)) throw new HttpError(400,'Informe página somente para PDF.');
    const plan = await pool.query('SELECT id FROM plans WHERE company_id=$1 AND id=$2',[request.company!.id,request.params.planId]);
    if (!plan.rowCount) throw new HttpError(404,'Planta não encontrada nesta empresa.');
    if (converting) throw new HttpError(429,'Uma importação está em andamento. Aguarde e tente novamente.');
    converting = true;
    const original = randomUUID(), rendered = randomUUID(), written: string[] = [];
    let client: pg.PoolClient | undefined;
    try {
      const image = await convert(bytes,type!,page);
      if (image.png.length > maximum) throw new HttpError(400,'Fundo renderizado excede 20 MiB. Simplifique a imagem.');
      client = await pool.connect(); await client.query('BEGIN');
      // Serializa quota/exclusão da planta, sem modificar o layout ou sua revisão.
      if (!(await client.query('SELECT id FROM plans WHERE company_id=$1 AND id=$2 FOR UPDATE',[request.company!.id,request.params.planId])).rowCount)
        throw new HttpError(404,'Planta não encontrada nesta empresa.');
      const usage = await client.query('SELECT count(*)::int n,coalesce(sum(byte_size),0)::bigint bytes FROM plan_files WHERE company_id=$1 AND plan_id=$2',[request.company!.id,request.params.planId]);
      if (usage.rows[0].n >= 200 || Number(usage.rows[0].bytes)+bytes.length+image.png.length > 512*1024*1024)
        throw new HttpError(409,'Limite de 100 importações ou 512 MiB por planta atingido.');
      await mkdir(root,{ recursive: true });
      for (const [id,data] of [[original,bytes],[rendered,image.png]] as const) {
        const path = filePath(root,id), handle = await open(path,'wx',0o600); written.push(path);
        try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
      }
      await client.query("INSERT INTO plan_files(id,company_id,plan_id,kind,media_type,byte_size,sha256) VALUES ($1,$2,$3,'original',$4,$5,$6)",[original,request.company!.id,request.params.planId,type,bytes.length,sha(bytes)]);
      await client.query("INSERT INTO plan_files(id,company_id,plan_id,kind,media_type,byte_size,sha256,original_id,page,width,height) VALUES ($1,$2,$3,'rendered','image/png',$4,$5,$6,$7,$8,$9)",[rendered,request.company!.id,request.params.planId,image.png.length,sha(image.png),original,page,image.width,image.height]);
      await client.query('COMMIT');
      const background: PlanBackground = { originalFileId: original, renderedFileId: rendered, page, sourceWidthPx: image.width, sourceHeightPx: image.height,
        placement: { x: 0, y: 0, width: image.width/80, height: image.height/80, rotation: 0 }, opacity: 1 };
      return reply.code(201).send({ background });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      await Promise.all(written.map(path => unlink(path).catch(() => {}))); throw error;
    } finally { client?.release(); converting = false; }
  });
  app.get<{ Params: Params & { fileId: string } }>('/api/companies/:companyId/plans/:planId/files/:fileId', {
    config: { access: 'company' }, schema: { params: { ...params, required: [...params.required,'fileId'], properties: { ...params.properties, fileId: uuid } } },
  }, async (request,reply) => {
    const result = await pool.query('SELECT id,media_type,byte_size,sha256,kind FROM plan_files WHERE company_id=$1 AND plan_id=$2 AND id=$3',[request.company!.id,request.params.planId,request.params.fileId]);
    if (!result.rowCount) throw new HttpError(404,'Arquivo não encontrado nesta planta.');
    const row = result.rows[0];
    // O_NOFOLLOW evita que um symlink no diretório privado vire leitura externa.
    const handle = await open(filePath(root,row.id),constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)).catch(() => { throw new HttpError(404,'Arquivo não disponível.'); });
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== row.byte_size) throw new HttpError(404,'Arquivo não disponível.');
      const bytes = await handle.readFile();
      if (sha(bytes) !== row.sha256) throw new HttpError(404,'Arquivo não disponível.');
      return reply.header('Content-Disposition',`${row.kind === 'rendered' ? 'inline' : 'attachment'}; filename="${row.id}.${row.media_type === 'application/pdf' ? 'pdf' : row.media_type === 'image/jpeg' ? 'jpg' : 'png'}"`)
        .header('Cross-Origin-Resource-Policy','same-origin').header('Content-Security-Policy',"sandbox; default-src 'none'").type(row.media_type).send(bytes);
    } finally { await handle.close(); }
  });
}
