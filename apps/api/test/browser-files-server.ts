/** QA etapa 14: reinício reaproveita apenas o banco/volume sintético registrado aqui. */
import { randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { buildApp } from '../src/app.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { syntheticPdf } from './file-fixtures.js';

const output = fileURLToPath(new URL('../../../output/playwright/',import.meta.url)), runtime = `${output}/files-runtime.json`;
const config=databaseConfig(),root=new pg.Pool({...config,max:1});
let credential: {database:string;login:string;password:string;filesDirectory:string};
try { credential=JSON.parse(await readFile(runtime,'utf8')); }
catch { const suffix=randomBytes(6).toString('hex'); credential={database:`topologia_new_test14_browser_${suffix}`,login:'qa.synthetic',password:randomBytes(24).toString('base64url'),filesDirectory:`/data/files/qa14_${suffix}`}; }
if(!/^topologia_new_test14_browser_[a-f0-9]{12}$/.test(credential.database)
  || credential.filesDirectory !== `/data/files/qa14_${credential.database.slice(-12)}`) throw new Error('Registro QA inválido.');
const pool=new pg.Pool({...config,database:credential.database,max:5});
root.on('error',() => console.warn('Conexão QA interrompida.'));
pool.on('error',() => console.warn('Conexão QA interrompida.'));
const exists=(await root.query('SELECT datname FROM pg_database WHERE datname=$1',[credential.database])).rowCount;
if(process.argv.includes('--cleanup')) {
  if(exists) await root.query(`DROP DATABASE "${credential.database}" WITH (FORCE)`);
  await rm(credential.filesDirectory,{recursive:true,force:true}); await rm(runtime,{force:true});
  await pool.end(); await root.end(); console.log('Banco, arquivos e credencial QA removidos.'); process.exit(0);
}
if(!exists) {
  await root.query(`CREATE DATABASE "${credential.database}"`); await runMigrations(pool);
  await provisionAdmin(pool,{...credential,name:'Administrador sintético etapa 14'});
}
await mkdir(output,{recursive:true}); await writeFile(runtime,JSON.stringify(credential),{mode:0o600});
const png=await sharp({create:{width:800,height:600,channels:3,background:'#e6dcc3'}}).composite([{input:Buffer.from('<svg width="800" height="600"><rect x="100" y="100" width="600" height="400" fill="none" stroke="#374151" stroke-width="8"/><path d="M400 100V500" stroke="#374151" stroke-width="8"/></svg>')}]).png().toBuffer();
await writeFile(`${output}/stage14.png`,png); await writeFile(`${output}/stage14.jpg`,await sharp(png).jpeg().toBuffer()); await writeFile(`${output}/stage14.pdf`,syntheticPdf());
const app=await buildApp(pool,{origins:['http://localhost:5174','http://127.0.0.1:5174'],production:false,sessionSeconds:28800},false,credential.filesDirectory);
await app.listen({host:'0.0.0.0',port:3002});
console.log('QA etapa 14 pronto. Credenciais temporárias no arquivo ignorado files-runtime.json.');
async function stop(cleanup=false) {
  await app.close(); await pool.end();
  if(cleanup) { await root.query(`DROP DATABASE "${credential.database}" WITH (FORCE)`); await rm(credential.filesDirectory,{recursive:true,force:true}); await rm(runtime,{force:true}); }
  await root.end(); process.exit(0);
}
process.once('SIGTERM',() => void stop()); process.once('SIGINT',() => void stop());
process.once('SIGUSR2',() => void stop(true));
