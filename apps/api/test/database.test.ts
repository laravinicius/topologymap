import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { databaseConfig } from '../src/database/config.js';
import { migrationsDirectory, runMigrations } from '../src/database/migrations.js';

const config = databaseConfig();
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const admin = new pg.Pool({ ...config, max: 2 });
const pools: pg.Pool[] = [];
const databases: string[] = [];
const directories: string[] = [];
const id = () => randomUUID();
const rectangle = { x: -1, y: 2, width: 1.2, height: 0.6, rotation: 90 };
const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }];
const migrationCount = 6;
type Queryable = Pick<pg.Pool, 'query'>;

async function database(label: string): Promise<pg.Pool> {
  const name = `topologia_new_test02_${runId}_${label}`;
  assert.match(name, /^topologia_new_test02_[a-f0-9]{12}_[a-z]+$/);
  assert.notEqual(name, config.database);
  await admin.query(`CREATE DATABASE "${name}"`);
  databases.push(name);
  const pool = new pg.Pool({ ...config, database: name, max: 6 });
  pools.push(pool);
  return pool;
}
async function errorCode(pool: Queryable, sql: string, parameters: unknown[], code: string) {
  await assert.rejects(pool.query(sql, parameters), (error: unknown) => {
    assert.equal((error as { code?: string }).code, code); return true;
  });
}
async function schema(pool: pg.Pool) {
  const tables = await pool.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
  const constraints = await pool.query(`SELECT c.relname, x.conname, pg_get_constraintdef(x.oid) AS definition
    FROM pg_constraint x JOIN pg_class c ON c.oid = x.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' ORDER BY c.relname, x.conname`);
  const indexes = await pool.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  return { tables: tables.rows, constraints: constraints.rows, indexes: indexes.rows };
}
async function fixture(pool: pg.Pool, label: string) {
  const company = id(), unit = id(), otherUnit = id(), floor = id(), otherFloor = id(), remoteFloor = id();
  const plan = id(), otherPlan = id(), remotePlan = id(), sector = id(), otherSector = id();
  const desk = id(), remoteDesk = id(), dc = id(), rack = id(), panel = id(), generic = id();
  await pool.query('INSERT INTO companies(id, name) VALUES ($1, $2)', [company, `Empresa sintética ${label}`]);
  for (const [key, name] of [[unit, 'Matriz'], [otherUnit, 'Filial']])
    await pool.query('INSERT INTO units(id, company_id, name, classification) VALUES ($1,$2,$3,$3)', [key, company, name]);
  for (const [key, parent, name] of [[floor, unit, 'Andar 1'], [otherFloor, unit, 'Andar 2'], [remoteFloor, otherUnit, 'Andar 1']])
    await pool.query('INSERT INTO floors(id, company_id, unit_id, name) VALUES ($1,$2,$3,$4)', [key, company, parent, name]);
  for (const [key, parentUnit, parentFloor] of [[plan, unit, floor], [otherPlan, unit, otherFloor], [remotePlan, otherUnit, remoteFloor]])
    await pool.query('INSERT INTO plans(id, company_id, unit_id, floor_id, name) VALUES ($1,$2,$3,$4,$5)', [key, company, parentUnit, parentFloor, 'Planta']);
  for (const [key, parent] of [[sector, plan], [otherSector, otherPlan]])
    await pool.query('INSERT INTO sectors(id, company_id, plan_id, name, polygon) VALUES ($1,$2,$3,$4,$5)', [key, company, parent, 'Setor', JSON.stringify(polygon)]);
  for (const [key, parent] of [[desk, plan], [remoteDesk, otherPlan]])
    await pool.query('INSERT INTO desks(id, company_id, plan_id, name) VALUES ($1,$2,$3,$4)', [key, company, parent, 'Mesa 1']);
  await pool.query('INSERT INTO datacenters(id, company_id, unit_id, plan_id, name) VALUES ($1,$2,$3,$4,$5)', [dc, company, unit, plan, 'Datacenter']);
  await pool.query('INSERT INTO racks(id, company_id, unit_id, datacenter_id, name, capacity_u) VALUES ($1,$2,$3,$4,$5,42)', [rack, company, unit, dc, 'Rack 01']);
  await pool.query(`INSERT INTO equipment(id,company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u)
    VALUES ($1,$3,$4,'Panel','patch_panel','Patch panel',1,2,42), ($2,$3,$4,'Servidor','generic','Servidor',3,2,42)`, [panel, generic, company, rack]);
  const points = Array.from({ length: 8 }, id), ports = Array.from({ length: 8 }, id);
  for (let i = 0; i < 8; i++) {
    await pool.query('INSERT INTO points(id,company_id,desk_id,name,ordinal) VALUES ($1,$2,$3,$4,$5)', [points[i], company, desk, `Ponto ${i + 1}`, i + 1]);
    await pool.query('INSERT INTO ports(id,company_id,equipment_id,name,ordinal) VALUES ($1,$2,$3,$4,$5)', [ports[i], company, panel, `Porta ${i + 1}`, i + 1]);
  }
  return { company, unit, otherUnit, floor, otherFloor, plan, otherPlan, remotePlan, sector, otherSector, desk, remoteDesk, dc, rack, panel, generic, points, ports };
}
async function insertEquipment(pool: Queryable, rack: string, start: number, height: number, name: string = id(), kind = 'generic') {
  return pool.query(`INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u)
    SELECT company_id,id,$2,$5,'Teste',$3,$4,capacity_u FROM racks WHERE id=$1 RETURNING id`, [rack, name, start, height, kind]);
}

/** Prova de concorrência: a segunda gravação realmente aguarda um lock da primeira transação. */
async function race(pool: pg.Pool, first: (client: pg.PoolClient) => Promise<unknown>, second: (client: pg.PoolClient) => Promise<unknown>, expected: string,
  isolation = 'READ COMMITTED') {
  const a = await pool.connect(), b = await pool.connect();
  let pending: Promise<string> | undefined;
  try {
    await a.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    await b.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    // Fixar o snapshot no teste REPEATABLE READ antes da alteração concorrente.
    await b.query('SELECT count(*) FROM racks');
    const pid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await first(a);
    pending = second(b).then(() => 'success', error => (error as { code: string }).code);
    let blocked = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      blocked = (await pool.query("SELECT wait_event_type = 'Lock' AS blocked FROM pg_stat_activity WHERE pid = $1", [pid])).rows[0]?.blocked;
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(blocked, true, 'segunda sessão deve aguardar lock real');
    await a.query('COMMIT');
    assert.equal(await pending, expected);
    await b.query('ROLLBACK');
  } finally {
    await a.query('ROLLBACK'); await b.query('ROLLBACK');
    if (pending) await pending;
    a.release(); b.release();
  }
}

test('etapa 02: migrações e integridade em PostgreSQL real, com bancos sintéticos isolados', { timeout: 120000 }, async t => {
  try {
    const fresh = await database('fresh');
    const upgrade = await database('upgrade');
    await t.test('banco novo: status não cria tabelas; apply e reaplicação', async () => {
      assert.deepEqual((await runMigrations(fresh, { statusOnly: true })).map(x => x.state), Array(migrationCount).fill('pending'));
      assert.equal((await fresh.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count, 0);
      await runMigrations(fresh); await runMigrations(fresh);
      assert.equal((await fresh.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, migrationCount);
      assert.deepEqual((await runMigrations(fresh, { statusOnly: true })).map(x => x.state), Array(migrationCount).fill('applied'));
    });
    await t.test('banco inicializado: 001 com dados -> 002/003/004/005, preservação e esquema igual ao banco novo', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'topologia-stage02-upgrade-')); directories.push(directory);
      await cp(join(migrationsDirectory, '001_access_hierarchy.sql'), join(directory, '001_access_hierarchy.sql'));
      await runMigrations(upgrade, { directory });
      const marker = id(), user = id(), unit = id(), floor = id(), plan = id(), sector = id(), desk = id();
      await upgrade.query('INSERT INTO companies(id,name) VALUES ($1,$2)', [marker, 'Marcador sintético de preservação']);
      await upgrade.query("INSERT INTO users(id,login,name,password_hash) VALUES ($1,'upgrade','Usuário sintético','hash-sintético')", [user]);
      await upgrade.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'manager')",[user,marker]);
      await upgrade.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')",[user,'b'.repeat(64)]);
      await upgrade.query("INSERT INTO units(id,company_id,name) VALUES ($1,$2,'Matriz sintética')",[unit,marker]);
      await upgrade.query("INSERT INTO floors(id,company_id,unit_id,name) VALUES ($1,$2,$3,'Andar sintético')",[floor,marker,unit]);
      await upgrade.query("INSERT INTO plans(id,company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4,'Planta sintética')",[plan,marker,unit,floor]);
      await upgrade.query("INSERT INTO sectors(id,company_id,plan_id,name,polygon) VALUES ($1,$2,$3,'Setor sintético',$4)",[sector,marker,plan,JSON.stringify(polygon)]);
      await upgrade.query("INSERT INTO desks(id,company_id,plan_id,sector_id,name,placement) VALUES ($1,$2,$3,$4,'Mesa sintética',$5)",[desk,marker,plan,sector,JSON.stringify(rectangle)]);
      await upgrade.query("INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,'Ponto sintético',1)",[marker,desk]);
      await upgrade.query("INSERT INTO datacenters(company_id,unit_id,plan_id,name) VALUES ($1,$2,$3,'Datacenter sintético')",[marker,unit,plan]);
      const oldTables = ['users','sessions','companies','company_permissions','units','floors','plans','sectors','desks','points','datacenters'];
      const preserved = [];
      for (const table of oldTables) preserved.push((await upgrade.query(`SELECT to_jsonb(t) - 'camera' AS row FROM ${table} t ORDER BY id`)).rows);
      await runMigrations(upgrade);
      assert.equal((await upgrade.query('SELECT name FROM companies WHERE id=$1', [marker])).rows[0].name, 'Marcador sintético de preservação');
      for (const [i,table] of oldTables.entries()) assert.deepEqual((await upgrade.query(`SELECT to_jsonb(t) - 'camera' AS row FROM ${table} t ORDER BY id`)).rows,preserved[i]);
      assert.deepEqual(await schema(upgrade), await schema(fresh));
    });
    await t.test('upgrade 003 -> 004/005 preserva layout, racks, equipamentos, portas e conexões existentes', async () => {
      const initialized = await database('upgradelayout');
      const directory = await mkdtemp(join(tmpdir(), 'topologia-stage11-upgrade-')); directories.push(directory);
      for (const file of ['001_access_hierarchy.sql', '002_racks_connections.sql', '003_login_limits.sql'])
        await cp(join(migrationsDirectory, file), join(directory, file));
      await runMigrations(initialized, { directory });
      const existing = await fixture(initialized, 'Upgrade11');
      await initialized.query('UPDATE racks SET plan_id=$2,placement=$3 WHERE id=$1', [existing.rack, existing.plan, JSON.stringify(rectangle)]);
      await initialized.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [existing.company, existing.points[0], existing.ports[0]]);
      const tables = ['companies', 'units', 'floors', 'plans', 'sectors', 'desks', 'points', 'datacenters', 'racks', 'equipment', 'ports', 'connections'];
      const before = [];
      for (const table of tables) before.push((await initialized.query(`SELECT to_jsonb(t) - 'camera' AS row FROM ${table} t ORDER BY id`)).rows);
      await runMigrations(initialized);
      for (const [i, table] of tables.entries())
        assert.deepEqual((await initialized.query(`SELECT to_jsonb(t) - 'camera' AS row FROM ${table} t ORDER BY id`)).rows, before[i], table);
      assert.deepEqual(await schema(initialized), await schema(fresh));
      assert.deepEqual((await initialized.query('SELECT camera FROM plans WHERE id=$1', [existing.plan])).rows[0].camera, { x: 0, y: 0, zoom: 1 });
    });
    await t.test('upgrade 004 -> 005 preserva dados e renomear setor avança revisão', async () => {
      const initialized = await database('upgradesectors');
      const directory = await mkdtemp(join(tmpdir(), 'topologia-stage13-upgrade-')); directories.push(directory);
      for (const file of ['001_access_hierarchy.sql','002_racks_connections.sql','003_login_limits.sql','004_layout_revisions.sql'])
        await cp(join(migrationsDirectory,file),join(directory,file));
      await runMigrations(initialized,{directory});
      const existing = await fixture(initialized,'Upgrade13');
      await initialized.query('UPDATE desks SET sector_id=$2 WHERE id=$1',[existing.desk,existing.sector]);
      await initialized.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[existing.company,existing.points[0],existing.ports[0]]);
      const tables = ['plans','sectors','desks','points','racks','equipment','ports','connections'];
      const before = [];
      for (const table of tables) before.push((await initialized.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY id`)).rows);
      await runMigrations(initialized);
      for (const [i,table] of tables.entries()) assert.deepEqual((await initialized.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY id`)).rows,before[i]);
      assert.deepEqual(await schema(initialized),await schema(fresh));
      const revision = Number((await initialized.query('SELECT revision FROM plans WHERE id=$1',[existing.plan])).rows[0].revision);
      await initialized.query("UPDATE sectors SET name='Setor renomeado' WHERE id=$1",[existing.sector]);
      assert.equal(Number((await initialized.query('SELECT revision FROM plans WHERE id=$1',[existing.plan])).rows[0].revision),revision+1);
      assert.equal((await initialized.query('SELECT sector_id FROM desks WHERE id=$1',[existing.desk])).rows[0].sector_id,existing.sector);
    });
    await t.test('upgrade 005 -> 006 preserva parque, geometria e conexão em banco inicializado', async () => {
      const initialized=await database('upgradefiles');
      const directory=await mkdtemp(join(tmpdir(),'topologia-stage14-upgrade-')); directories.push(directory);
      for(const file of ['001_access_hierarchy.sql','002_racks_connections.sql','003_login_limits.sql','004_layout_revisions.sql','005_sector_editing.sql'])
        await cp(join(migrationsDirectory,file),join(directory,file));
      await runMigrations(initialized,{directory});
      const existing=await fixture(initialized,'Upgrade14');
      await initialized.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[existing.company,existing.points[0],existing.ports[0]]);
      const tables=['companies','units','floors','plans','sectors','desks','points','datacenters','racks','equipment','ports','connections'];
      const before=[]; for(const table of tables) before.push((await initialized.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY id`)).rows);
      await runMigrations(initialized);
      for(const [i,table] of tables.entries()) assert.deepEqual((await initialized.query(`SELECT to_jsonb(t) row FROM ${table} t ORDER BY id`)).rows,before[i],table);
      assert.equal((await initialized.query('SELECT count(*)::int n FROM plan_files')).rows[0].n,0);
      assert.deepEqual(await schema(initialized),await schema(fresh));
    });
    await t.test('checksum divergente impede execução e arquivo ausente não é aceito', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'topologia-stage02-checksum-')); directories.push(directory);
      await cp(migrationsDirectory, directory, { recursive: true });
      await writeFile(join(directory, '001_access_hierarchy.sql'), '-- alterado\n', { flag: 'a' });
      await assert.rejects(runMigrations(fresh, { directory }), /Histórico divergente/);
      await cp(join(migrationsDirectory, '001_access_hierarchy.sql'), join(directory, '001_access_hierarchy.sql'));
      await rm(join(directory, '006_plan_files.sql'));
      await assert.rejects(runMigrations(fresh, { directory }), /Histórico divergente/);
      assert.equal((await fresh.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, migrationCount);
    });
    await t.test('falha SQL reverte DDL e histórico da migração; correção permite retomar', async () => {
      const rollback = await database('rollback');
      const directory = await mkdtemp(join(tmpdir(), 'topologia-stage02-rollback-')); directories.push(directory);
      await writeFile(join(directory, '001_probe.sql'), 'CREATE TABLE probe(id integer PRIMARY KEY); INSERT INTO probe VALUES (1);');
      await writeFile(join(directory, '002_failure.sql'), 'CREATE TABLE partial(id integer); SELECT 1/0;');
      await assert.rejects(runMigrations(rollback, { directory }), (e: unknown) => (e as { code: string }).code === '22012');
      assert.equal((await rollback.query("SELECT to_regclass('partial') AS relation")).rows[0].relation, null);
      assert.equal((await rollback.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 1);
      assert.equal((await rollback.query('SELECT id FROM probe')).rows[0].id, 1);
      await writeFile(join(directory, '002_failure.sql'), 'CREATE TABLE partial(id integer);');
      await runMigrations(rollback, { directory });
      assert.equal((await rollback.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 2);
    });
    await t.test('dois migradores simultâneos aplicam cada versão uma única vez', async () => {
      const concurrent = await database('migrators');
      await Promise.all([runMigrations(concurrent), runMigrations(concurrent)]);
      assert.equal((await concurrent.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, migrationCount);
    });

    const a = await fixture(fresh, 'A'), b = await fixture(fresh, 'B');
    await t.test('usuário pode ter papéis distintos; sessão e permissões têm restrições', async () => {
      const user = id();
      await fresh.query("INSERT INTO users(id,login,name,password_hash) VALUES ($1,'sintetico','Usuário sintético','hash-apenas-teste')", [user]);
      await fresh.query("INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'manager'),($1,$3,'viewer')", [user,a.company,b.company]);
      assert.deepEqual((await fresh.query('SELECT role FROM company_permissions WHERE user_id=$1 ORDER BY role', [user])).rows.map(x => x.role), ['manager', 'viewer']);
      await errorCode(fresh, "INSERT INTO company_permissions(user_id,company_id,role) VALUES ($1,$2,'viewer')", [user,a.company], '23505');
      await errorCode(fresh, "UPDATE company_permissions SET role='admin' WHERE user_id=$1", [user], '23514');
      await errorCode(fresh, "INSERT INTO users(login,name,password_hash) VALUES ('SINTETICO','Outro','hash')", [], '23505');
      await errorCode(fresh, "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES ($1,$2,now()-interval '1 hour')", [user,'a'.repeat(64)], '23514');
      await errorCode(fresh, "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES ($1,'token-aberto',now()+interval '1 hour')", [user], '23514');
      await fresh.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [user,'a'.repeat(64)]);
      await errorCode(fresh, "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [user,'a'.repeat(64)], '23505');
    });

    const crossCompany: [string, string, unknown[]][] = [
      ['andar', 'INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,$3)', [a.company,b.unit,'Teste']],
      ['planta', 'INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4)', [a.company,b.unit,b.floor,'Teste']],
      ['setor', 'INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,$3,$4)', [a.company,b.plan,'Teste',JSON.stringify(polygon)]],
      ['mesa', 'INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,$3)', [a.company,b.plan,'Teste']],
      ['ponto', 'INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,$3,99)', [a.company,b.desk,'Teste']],
      ['datacenter', 'INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3)', [a.company,b.unit,'Teste']],
      ['rack', 'INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,42)', [a.company,b.unit,b.dc,'Teste']],
      ['equipamento', "INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u) VALUES ($1,$2,$3,'generic','Teste',20,1,42)", [a.company,b.rack,'Teste']],
      ['porta', 'INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,$3,99)', [a.company,b.panel,'Teste']],
      ['conexão pelo ponto', 'INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a.company,b.points[0],a.ports[0]]],
      ['conexão pela porta', 'INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a.company,a.points[0],b.ports[0]]],
    ];
    for (const [label, sql, params] of crossCompany)
      await t.test(`isolamento entre empresas: ${label}`, () => errorCode(fresh, sql, params, '23503'));
    await t.test('UPDATE também não pode mover filho para pai de outra empresa', async () => {
      await errorCode(fresh, "UPDATE points SET desk_id=$1,name='Transferência inválida',ordinal=99 WHERE id=$2", [b.desk,a.points[0]], '23503');
      await errorCode(fresh, "UPDATE ports SET equipment_id=$1,name='Transferência inválida',ordinal=99 WHERE id=$2", [b.panel,a.ports[0]], '23503');
    });
    await t.test('filiação: planta/andar, setor/planta e localização de rack/DC na mesma unidade', async () => {
      await errorCode(fresh, 'INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4)', [a.company,a.otherUnit,a.floor,'Errada'], '23503');
      await errorCode(fresh, 'UPDATE desks SET sector_id=$1 WHERE id=$2', [a.otherSector,a.desk], '23503');
      await errorCode(fresh, 'UPDATE datacenters SET plan_id=$1 WHERE id=$2', [a.remotePlan,a.dc], '23503');
      await errorCode(fresh, 'UPDATE racks SET plan_id=$1 WHERE id=$2', [a.remotePlan,a.rack], '23503');
      await errorCode(fresh, 'UPDATE racks SET unit_id=$1 WHERE id=$2', [a.otherUnit,a.rack], '23503');
      await fresh.query('UPDATE desks SET sector_id=$1 WHERE id=$2', [a.sector,a.desk]);
      await fresh.query('UPDATE racks SET plan_id=$1,placement=$2 WHERE id=$3', [a.otherPlan,JSON.stringify(rectangle),a.rack]);
    });
    await t.test('nomes únicos no pai; grafias, zeros e nomes iguais em pais diferentes preservados', async () => {
      await fresh.query("INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Mesa 01'),($1,$2,'mesa 1')", [a.company,a.plan]);
      const names = (await fresh.query('SELECT name FROM desks WHERE plan_id=$1 ORDER BY name COLLATE "C"', [a.plan])).rows.map(x => x.name);
      assert.deepEqual(names, ['Mesa 01','Mesa 1','mesa 1']);
      const uniqueCases: [string, unknown[]][] = [
        ['INSERT INTO companies(name) VALUES ($1)', ['Empresa sintética A']],
        ["INSERT INTO units(company_id,name) VALUES ($1,'Matriz')", [a.company]],
        ["INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,'Andar 1')", [a.company,a.unit]],
        ["INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,'Planta')", [a.company,a.unit,a.floor]],
        ["INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,'Setor',$3)", [a.company,a.plan,JSON.stringify(polygon)]],
        ["INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,'Mesa 1')", [a.company,a.plan]],
        ["INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,'Ponto 1',99)", [a.company,a.desk]],
        ["INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,'Datacenter')", [a.company,a.unit]],
        ["INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,'Rack 01',42)", [a.company,a.unit,a.dc]],
        ["INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Porta 1',99)", [a.company,a.panel]],
      ];
      for (const [sql, params] of uniqueCases) await errorCode(fresh,sql,params,'23505');
      await assert.rejects(insertEquipment(fresh,a.rack,20,1,'Panel'), (e: unknown) => (e as { code: string }).code === '23505');
      await errorCode(fresh, "INSERT INTO companies(name) VALUES ('   ')", [], '23514');
    });
    await t.test('conexão única, consulta inversa, renomeação/posição preserva IDs e vínculos, andares distintos permitidos', async () => {
      const connection = id();
      await fresh.query('INSERT INTO connections(id,company_id,point_id,port_id) VALUES ($1,$2,$3,$4)', [connection,a.company,a.points[0],a.ports[0]]);
      await errorCode(fresh, 'INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a.company,a.points[0],a.ports[1]], '23505');
      await errorCode(fresh, 'INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a.company,a.points[1],a.ports[0]], '23505');
      await fresh.query("UPDATE desks SET name='Mesa renomeada',placement=$1 WHERE id=$2", [JSON.stringify(rectangle),a.desk]);
      await fresh.query("UPDATE ports SET name='Porta renomeada' WHERE id=$1", [a.ports[0]]);
      const inverse = (await fresh.query(`SELECT c.id, p.id AS point_id, d.name AS desk_name, r.name AS port_name FROM connections c
        JOIN points p ON p.id=c.point_id JOIN desks d ON d.id=p.desk_id JOIN ports r ON r.id=c.port_id WHERE c.port_id=$1`, [a.ports[0]])).rows[0];
      assert.deepEqual(inverse, { id: connection, point_id:a.points[0],desk_name:'Mesa renomeada',port_name:'Porta renomeada' });
      await fresh.query("UPDATE points SET desk_id=$1,name='Outro andar',ordinal=99 WHERE id=$2", [a.remoteDesk,a.points[1]]);
      await fresh.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)', [a.company,a.points[1],a.ports[1]]);
      await fresh.query('UPDATE connections SET port_id=$1 WHERE id=$2', [a.ports[2],connection]);
      assert.equal((await fresh.query('SELECT revision FROM connections WHERE id=$1', [connection])).rows[0].revision, '2');
      await errorCode(fresh, 'UPDATE desks SET id=$1 WHERE id=$2', [id(),a.desk], '23514');
    });
    await t.test('dependências impedem exclusão de ponto, porta, mesa, equipamento, rack e pais', async () => {
      for (const [table, key] of [['points',a.points[0]],['ports',a.ports[2]],['desks',a.desk],['equipment',a.panel],['racks',a.rack],['datacenters',a.dc],['plans',a.plan],['floors',a.floor],['units',a.unit],['companies',a.company]])
        await errorCode(fresh,`DELETE FROM ${table} WHERE id=$1`,[key],'23001');
      await errorCode(fresh, "UPDATE equipment SET kind='generic' WHERE id=$1", [a.panel], '23503');
    });
    await t.test('U positivas/inteiras, múltiplas U, adjacência, sobreposição e capacidade real', async () => {
      await insertEquipment(fresh,a.rack,5,3,'Adjacente');
      for (const [start,height,code] of [[4,2,'23P01'],[7,2,'23P01'],[42,2,'23514'],[0,1,'23514'],[10,0,'23514'],[-1,1,'23514'],[10,1.5,'22P02']] as const)
        await assert.rejects(insertEquipment(fresh,a.rack,start,height), (e: unknown) => (e as { code: string }).code === code);
      await errorCode(fresh, 'UPDATE racks SET capacity_u=6 WHERE id=$1', [a.rack], '23514');
      await fresh.query('UPDATE racks SET capacity_u=7 WHERE id=$1', [a.rack]);
      assert.deepEqual((await fresh.query('SELECT DISTINCT rack_capacity_u FROM equipment WHERE rack_id=$1',[a.rack])).rows, [{ rack_capacity_u:7 }]);
      await errorCode(fresh, "UPDATE equipment SET rack_capacity_u=100 WHERE id=$1", [a.generic], '23503');
      await errorCode(fresh, 'UPDATE equipment SET start_u=6 WHERE id=$1', [a.generic], '23P01');
      await fresh.query('UPDATE racks SET capacity_u=42 WHERE id=$1', [a.rack]);
      await fresh.query('UPDATE equipment SET start_u=20,height_u=3 WHERE id=$1', [a.generic]);
      await errorCode(fresh, 'UPDATE racks SET capacity_u=0 WHERE id=$1', [a.rack], '23514');
    });
    await t.test('somente patch panels têm portas; quantidade deriva de registros, ordinal e nome únicos', async () => {
      await errorCode(fresh, "INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Teste',1)", [a.company,a.generic], '23503');
      await errorCode(fresh, "INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Nova',1)", [a.company,a.panel], '23505');
      await errorCode(fresh, "INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,'Nova',0)", [a.company,a.panel], '23514');
      await errorCode(fresh, "INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,'Novo',0)", [a.company,a.desk], '23514');
      for (const count of [24,48]) {
        const panel = (await insertEquipment(fresh,a.rack,count === 24 ? 30 : 31,1,`Panel ${count}`,'patch_panel')).rows[0].id;
        await fresh.query(`INSERT INTO ports(company_id,equipment_id,name,ordinal)
          SELECT $1,$2,'Porta ' || n,n FROM generate_series(1,$3::int) n`, [a.company,panel,count]);
        assert.equal((await fresh.query('SELECT count(*)::int AS count FROM ports WHERE equipment_id=$1',[panel])).rows[0].count,count);
      }
    });
    await t.test('geometria persistida exige metros, dimensão/rotação válida e referências de parede', async () => {
      for (const placement of [{}, {...rectangle,width:0}, {...rectangle,rotation:360}, {...rectangle,x:'0'}])
        await errorCode(fresh,'UPDATE desks SET placement=$1 WHERE id=$2',[JSON.stringify(placement),a.desk],'23514');
      await errorCode(fresh,'UPDATE sectors SET polygon=$1 WHERE id=$2',[JSON.stringify([{x:0,y:0},{x:1,y:1},{x:2,y:2}]),a.sector],'23514');
      const geometry = {version:1,unit:'m',walls:[{id:'w1',start:{x:0,y:0},end:{x:4,y:0},thickness:0.15}],
        openings:[{id:'o1',kind:'door',wallId:'w1',offset:1,width:0.9}]};
      await fresh.query('UPDATE plans SET geometry=$1 WHERE id=$2',[JSON.stringify(geometry),a.plan]);
      for (const value of [{...geometry,unit:'px'}, {...geometry,walls:[...geometry.walls,...geometry.walls]},
        {...geometry,openings:[{...geometry.openings[0],wallId:'missing'}]}, {...geometry,openings:[{...geometry.openings[0],width:10}]}])
        await errorCode(fresh,'UPDATE plans SET geometry=$1 WHERE id=$2',[JSON.stringify(value),a.plan],'23514');
      await errorCode(fresh,'UPDATE datacenters SET plan_id=NULL,placement=$1 WHERE id=$2',[JSON.stringify(rectangle),a.dc],'23514');
    });

    await t.test('concorrência: duas associações à mesma porta -> apenas a primeira', async () => {
      await race(fresh, c => c.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[a.company,a.points[2],a.ports[3]]),
        c => c.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[a.company,a.points[3],a.ports[3]]),'23505');
    });
    await t.test('concorrência: duas associações ao mesmo ponto -> apenas a primeira', async () => {
      await race(fresh, c => c.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[a.company,a.points[4],a.ports[4]]),
        c => c.query('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3)',[a.company,a.points[4],a.ports[5]]),'23505');
    });
    await t.test('concorrência: equipamentos sobrepostos -> apenas o primeiro', async () => {
      await race(fresh,c => insertEquipment(c,a.rack,10,3),c => insertEquipment(c,a.rack,12,2),'23P01');
    });
    async function emptyRack(name: string) {
      return (await fresh.query('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,42) RETURNING id',[a.company,a.unit,a.dc,name])).rows[0].id;
    }
    await t.test('concorrência: instalação vence redução de capacidade -> redução rejeitada', async () => {
      const rack = await emptyRack('Corrida insert');
      await race(fresh,c => insertEquipment(c,rack,40,3),c => c.query('UPDATE racks SET capacity_u=20 WHERE id=$1',[rack]),'23514');
      assert.equal((await fresh.query('SELECT capacity_u FROM racks WHERE id=$1',[rack])).rows[0].capacity_u,42);
    });
    await t.test('concorrência: redução vence instalação com capacidade antiga -> FK rejeita inserção', async () => {
      const rack = await emptyRack('Corrida shrink');
      await race(fresh,c => c.query('UPDATE racks SET capacity_u=20 WHERE id=$1',[rack]),
        c => insertEquipment(c,rack,40,3),'23503');
      assert.equal((await fresh.query('SELECT count(*)::int AS count FROM equipment WHERE rack_id=$1',[rack])).rows[0].count,0);
    });
    await t.test('snapshot antigo (REPEATABLE READ): redução concorrente revalida e rejeita capacidade insuficiente', async () => {
      const rack = await emptyRack('Corrida snapshot');
      await race(fresh,c => insertEquipment(c,rack,40,3),c => c.query('UPDATE racks SET capacity_u=20 WHERE id=$1',[rack]),'23514','REPEATABLE READ');
      assert.equal((await fresh.query('SELECT capacity_u FROM racks WHERE id=$1',[rack])).rows[0].capacity_u,42);
    });
    await t.test('concorrência: mover equipamento para U alta impede redução simultânea', async () => {
      const rack = await emptyRack('Corrida update');
      const equipment = (await insertEquipment(fresh,rack,1,2)).rows[0].id;
      await race(fresh,c => c.query('UPDATE equipment SET start_u=40,height_u=3 WHERE id=$1',[equipment]),
        c => c.query('UPDATE racks SET capacity_u=20 WHERE id=$1',[rack]),'23514');
      assert.equal((await fresh.query('SELECT capacity_u FROM racks WHERE id=$1',[rack])).rows[0].capacity_u,42);
    });
    await t.test('concorrência: redução vence movimentação para U alta, sem gravação fora do rack', async () => {
      const rack = await emptyRack('Corrida move');
      const equipment = (await insertEquipment(fresh,rack,1,2)).rows[0].id;
      await race(fresh,c => c.query('UPDATE racks SET capacity_u=20 WHERE id=$1',[rack]),
        c => c.query('UPDATE equipment SET start_u=40,height_u=3 WHERE id=$1',[equipment]),'23514');
      assert.equal((await fresh.query('SELECT start_u,rack_capacity_u FROM equipment WHERE id=$1',[equipment])).rows[0].start_u,1);
    });
    await t.test('estado final: nenhum equipamento fora da capacidade e nenhuma sobreposição', async () => {
      assert.equal((await fresh.query(`SELECT count(*)::int AS count FROM equipment e JOIN racks r ON r.id=e.rack_id
        WHERE e.rack_capacity_u <> r.capacity_u OR e.start_u::bigint+e.height_u::bigint-1 > r.capacity_u`)).rows[0].count,0);
      assert.equal((await fresh.query(`SELECT count(*)::int AS count FROM equipment a JOIN equipment b
        ON a.rack_id=b.rack_id AND a.id < b.id AND a.occupied_u && b.occupied_u`)).rows[0].count,0);
    });
  } finally {
    for (const pool of pools) await pool.end();
    for (const name of databases) {
      assert.match(name, /^topologia_new_test02_[a-f0-9]{12}_[a-z]+$/); assert.notEqual(name,config.database);
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
    for (const directory of directories) await rm(directory,{recursive:true,force:true});
    await admin.end();
  }
});
