import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, readdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../src/app.js';
import { databaseConfig } from '../src/database/config.js';
import { runMigrations } from '../src/database/migrations.js';
import { provisionAdmin } from '../src/auth/provision.js';
import { hashPassword } from '../src/auth/password.js';
import { syntheticPdf } from './file-fixtures.js';

test('etapa 14: fundos privados, conversão, integridade e persistência em banco isolado', { timeout: 120000 }, async t => {
  const config = databaseConfig(), database = `topologia_new_test14_${randomBytes(6).toString('hex')}`;
  const root = new pg.Pool({...config,max:1}), pool = new pg.Pool({...config,database,max:5});
  const directory = await mkdtemp(join(tmpdir(),'topologia-files-')), origin = 'http://localhost:5173', password = randomBytes(24).toString('hex');
  const auth = { origins:[origin],production:false,sessionSeconds:28800 };
  let app: Awaited<ReturnType<typeof buildApp>> | undefined, created = false, cookie = '';
  try {
    await root.query(`CREATE DATABASE "${database}"`); created = true; await runMigrations(pool);
    await provisionAdmin(pool,{login:'files.qa',name:'Files QA',password});
    app = await buildApp(pool,auth,false,directory);
    const login = await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{login:'files.qa',password}});
    assert.equal(login.statusCode,200); cookie = login.headers['set-cookie']!.toString().split(';')[0]!;
    async function fixture(name: string) {
      const company = (await pool.query('INSERT INTO companies(name) VALUES ($1) RETURNING id',[name])).rows[0].id;
      const unit = (await pool.query("INSERT INTO units(company_id,name) VALUES ($1,'Unidade') RETURNING id",[company])).rows[0].id;
      const floor = (await pool.query("INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,'Andar') RETURNING id",[company,unit])).rows[0].id;
      const plan = (await pool.query("INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,'Planta') RETURNING id",[company,unit,floor])).rows[0].id;
      return {company,unit,floor,plan};
    }
    const a = await fixture('A QA'), b = await fixture('B QA');
    const base = `/api/companies/${a.company}/plans/${a.plan}`;
    const call = (method: 'GET'|'PUT'|'POST',url: string,payload?: object|Buffer,mediaType?: string) => app!.inject({method,url,headers:{origin,cookie,...(mediaType ? {'content-type':mediaType} : {})},payload});
    const upload = (bytes: Buffer,type='image/png',suffix='') => call('POST',`${base}/backgrounds${suffix}`,bytes,type);
    const png = await sharp({create:{width:400,height:300,channels:3,background:'#dfd5b0'}}).png().toBuffer();
    const jpg = await sharp(png).jpeg().toBuffer();
    let first: any, second: any, pdfBackground: any;
    await t.test('PNG/JPG reais são decodificados, original preservado e renderizado PNG',async () => {
      for (const [bytes,type] of [[png,'image/png'],[jpg,'image/jpeg']] as const) {
        const res = await upload(bytes,type); assert.equal(res.statusCode,201,res.body);
        const bg = res.json().background; if (type === 'image/png') first=bg; else second=bg;
        assert.equal(bg.page,null); assert.equal(bg.sourceWidthPx,400);
        const original = await call('GET',`${base}/files/${bg.originalFileId}`); assert.equal(original.statusCode,200); assert.deepEqual(original.rawPayload,bytes);
        const rendered = await call('GET',`${base}/files/${bg.renderedFileId}`); assert.equal(rendered.statusCode,200);
        assert.equal((await sharp(rendered.rawPayload).metadata()).format,'png');
        assert.equal(rendered.headers['cache-control'],'no-store'); assert.equal(rendered.headers['x-content-type-options'],'nosniff');
      }
    });
    await t.test('PDF de duas páginas renderiza página escolhida e rejeita página inexistente',async () => {
      const document = syntheticPdf();
      const one = await upload(document,'application/pdf','?page=1'); assert.equal(one.statusCode,201,one.body);
      const two = await upload(document,'application/pdf','?page=2'); assert.equal(two.statusCode,201,two.body); pdfBackground=two.json().background;
      const image1 = await call('GET',`${base}/files/${one.json().background.renderedFileId}`), image2 = await call('GET',`${base}/files/${pdfBackground.renderedFileId}`);
      assert.notDeepEqual(image1.rawPayload,image2.rawPayload); assert.equal(pdfBackground.page,2); assert.equal(pdfBackground.sourceWidthPx,600);
      assert.equal((await upload(document,'application/pdf','?page=3')).statusCode,400);
      assert.equal((await upload(document,'application/pdf')).statusCode,400);
      assert.equal((await upload(syntheticPdf(101),'application/pdf','?page=1')).statusCode,400);
    });
    await t.test('rejeita falsificação de tipo, truncamento, tamanho, dimensões e parâmetros/caminhos',async () => {
      const count = (await readdir(directory)).length;
      assert.equal((await upload(Buffer.from('<svg/>'))).statusCode,400);
      assert.equal((await upload(png,'image/jpeg')).statusCode,400);
      assert.equal((await upload(png.subarray(0,28))).statusCode,400);
      assert.equal((await upload(Buffer.from('%PDF-1.7\ntruncado'),'application/pdf','?page=1')).statusCode,400);
      assert.equal((await upload(Buffer.alloc(20*1024*1024+1))).statusCode,413);
      const wide = await sharp({create:{width:8193,height:1,channels:3,background:'white'}}).png().toBuffer();
      assert.equal((await upload(wide)).statusCode,400);
      const manyPixels=await sharp({create:{width:4001,height:4000,channels:3,background:'white'}}).png().toBuffer();
      assert.equal((await upload(manyPixels)).statusCode,400);
      assert.equal((await upload(png,'image/png','?page=1')).statusCode,400);
      assert.equal((await upload(png,'image/png','?path=../../secret')).statusCode,400);
      assert.equal((await call('GET',`${base}/files/%2e%2e%2fetc%2fpasswd`)).statusCode,400);
      assert.equal((await readdir(directory)).length,count);
    });
    await t.test('troca e calibração preservam mesa, pontos e conexão; conflito não sobrescreve',async () => {
      const desk = (await pool.query("INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Mesa QA') RETURNING id",[a.company,a.plan])).rows[0].id;
      const point = (await pool.query("INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,'Ponto 1',1) RETURNING id",[a.company,desk])).rows[0].id;
      const dc = (await pool.query("INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,'DC QA') RETURNING id",[a.company,a.unit])).rows[0].id;
      const rack = (await pool.query("INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,'Rack QA',24) RETURNING id",[a.company,a.unit,dc])).rows[0].id;
      const equipment = (await pool.query("INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u) VALUES ($1,$2,'PP','patch_panel','PP',1,1,24) RETURNING id",[a.company,rack])).rows[0].id;
      const port = (await pool.query("INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Porta 1',1) RETURNING id",[a.company,equipment])).rows[0].id;
      await pool.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[a.company,point,port]);
      const before = []; for (const table of ['desks','points','connections']) before.push((await pool.query(`SELECT to_jsonb(t) - 'updated_at' row FROM ${table} t ORDER BY id`)).rows);
      for (const bg of [first,second,pdfBackground]) {
        const snapshot = (await call('GET',`${base}/layout`)).json(); snapshot.layout.geometry.background={...bg,opacity:.4,placement:{x:2,y:3,width:10,height:7.5,rotation:30}};
        const res = await call('PUT',`${base}/layout`,{expectedRevision:snapshot.revision,layout:snapshot.layout}); assert.equal(res.statusCode,200,res.body);
        assert.equal((await call('PUT',`${base}/layout`,{expectedRevision:snapshot.revision,layout:snapshot.layout})).statusCode,409);
      }
      for (const [i,table] of ['desks','points','connections'].entries()) assert.deepEqual((await pool.query(`SELECT to_jsonb(t) - 'updated_at' row FROM ${table} t ORDER BY id`)).rows,before[i]);
      const current = (await call('GET',`${base}/layout`)).json(); current.layout.geometry.background.sourceWidthPx++;
      assert.equal((await call('PUT',`${base}/layout`,{expectedRevision:current.revision,layout:current.layout})).statusCode,400);
      current.layout.geometry.background=first; current.layout.geometry.background.opacity=2;
      assert.equal((await call('PUT',`${base}/layout`,{expectedRevision:current.revision,layout:current.layout})).statusCode,400);
    });
    await t.test('arquivos e referências de outra empresa/planta não são aceitos; SQL também protege',async () => {
      const wrong = `/api/companies/${b.company}/plans/${b.plan}`;
      assert.equal((await call('GET',`${wrong}/files/${first.originalFileId}`)).statusCode,404);
      const snap = (await call('GET',`${wrong}/layout`)).json(); snap.layout.geometry.background=first;
      assert.equal((await call('PUT',`${wrong}/layout`,{expectedRevision:snap.revision,layout:snap.layout})).statusCode,400);
      await assert.rejects(pool.query('UPDATE plans SET geometry=$2 WHERE id=$1',[b.plan,JSON.stringify(snap.layout.geometry)]),(e:unknown) => (e as {code:string}).code==='23514');
      assert.equal((await call('POST',`/api/companies/${a.company}/plans/${b.plan}/backgrounds`,png,'image/png')).statusCode,404);
      const sameCompanyPlan=(await pool.query("INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,'Outra planta') RETURNING id",[a.company,a.unit,a.floor])).rows[0].id;
      assert.equal((await call('GET',`/api/companies/${a.company}/plans/${sameCompanyPlan}/files/${first.originalFileId}`)).statusCode,404);
    });
    await t.test('reiniciar aplicação preserva original, renderizado, layout e sessão',async () => {
      const before = (await call('GET',`${base}/layout`)).json();
      await app!.close(); app=await buildApp(pool,auth,false,directory);
      assert.deepEqual((await call('GET',`${base}/layout`)).json(),before);
      assert.equal((await call('GET',`${base}/files/${pdfBackground.renderedFileId}`)).statusCode,200);
      assert.deepEqual((await call('GET',`${base}/files/${pdfBackground.originalFileId}`)).rawPayload,syntheticPdf());
    });
    await t.test('visualizador lê arquivos, não escreve; revogação e ausência de sessão bloqueiam',async () => {
      const user = (await pool.query("INSERT INTO users(login,name,password_hash) VALUES ('viewer.files','Viewer',$1) RETURNING id",[await hashPassword(password)])).rows[0].id;
      await pool.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'viewer')",[user,a.company]);
      const result = await app!.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{login:'viewer.files',password}});
      cookie=result.headers['set-cookie']!.toString().split(';')[0]!;
      assert.equal((await call('GET',`${base}/files/${first.originalFileId}`)).statusCode,200);
      assert.equal((await upload(png)).statusCode,403);
      const snap=(await call('GET',`${base}/layout`)).json(); assert.equal((await call('PUT',`${base}/layout`,{expectedRevision:snap.revision,layout:snap.layout})).statusCode,403);
      assert.equal((await call('GET',`/api/companies/${b.company}/plans/${b.plan}/files/${first.originalFileId}`)).statusCode,404);
      await pool.query('DELETE FROM company_permissions WHERE user_id=$1',[user]);
      assert.equal((await call('GET',`${base}/files/${first.originalFileId}`)).statusCode,404);
      cookie=''; assert.equal((await call('GET',`${base}/files/${first.originalFileId}`)).statusCode,401);
    });
    await t.test('leitura recusa symlink e adulteração no volume',async () => {
      const login=await app!.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{login:'files.qa',password}}); cookie=login.headers['set-cookie']!.toString().split(';')[0]!;
      await writeFile(join(directory,first.renderedFileId),Buffer.alloc(10));
      assert.equal((await call('GET',`${base}/files/${first.renderedFileId}`)).statusCode,404);
      await rm(join(directory,first.originalFileId)); await symlink('/etc/passwd',join(directory,first.originalFileId));
      assert.equal((await call('GET',`${base}/files/${first.originalFileId}`)).statusCode,404);
    });
    await t.test('quota por planta limita quantidade e bytes sem criar arquivos',async () => {
      const count=(await readdir(directory)).length;
      const fill=async (n:number,size:number) => pool.query(`INSERT INTO plan_files(id,company_id,plan_id,kind,media_type,byte_size,sha256)
        SELECT gen_random_uuid(),$1,$2,'original','image/png',$3,repeat('0',64) FROM generate_series(1,$4)`,[b.company,b.plan,size,n]);
      const attempt=() => call('POST',`/api/companies/${b.company}/plans/${b.plan}/backgrounds`,png,'image/png');
      await fill(200,1); assert.equal((await attempt()).statusCode,409);
      await pool.query('DELETE FROM plan_files WHERE company_id=$1',[b.company]);
      await fill(26,20*1024*1024); assert.equal((await attempt()).statusCode,409);
      assert.equal((await readdir(directory)).length,count);
    });
  } finally {
    await app?.close(); await pool.end(); if(created) await root.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await root.end(); await rm(directory,{recursive:true,force:true});
  }
});
