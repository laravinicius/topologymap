import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { rackLimits, type EquipmentCreateInput, type EquipmentUpdateInput, type RackInput } from '@topologia-new/domain';
import { HttpError } from '../auth/authorization.js';
import { uuid } from '../admin/routes.js';
import { connectionJson } from '../connections/query.js';

type Context = { companyId: string; unitId: string; datacenterId: string; rackId: string; equipmentId: string; portId: string };
const name = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const units = { type: 'integer', minimum: 1, maximum: rackLimits.units };
const count = { type: 'integer', minimum: 1, maximum: rackLimits.ports };
const keys = ['companyId', 'unitId', 'datacenterId'];
const params = (extra: string[] = []) => ({ type: 'object', required: [...keys, ...extra], additionalProperties: false,
  properties: Object.fromEntries([...keys, ...extra].map(key => [key, uuid])) });
const config = { access: 'company' as const };
const rackFields = 'r.id,r.name,r.company_id AS "companyId",r.unit_id AS "unitId",r.datacenter_id AS "datacenterId",r.plan_id AS "planId",r.placement,r.capacity_u AS "capacityU",r.created_at AS "createdAt",r.updated_at AS "updatedAt"';
const equipmentFields = 'e.id,e.name,e.company_id AS "companyId",e.rack_id AS "rackId",e.kind,e.equipment_type AS "equipmentType",e.start_u AS "startU",e.height_u AS "heightU",e.created_at AS "createdAt",e.updated_at AS "updatedAt"';
const equipmentCount = '(SELECT count(*)::int FROM ports p WHERE p.company_id=e.company_id AND p.equipment_id=e.id) AS "portCount"';
const portsQuery = `SELECT p.id,p.name,p.company_id AS "companyId",p.equipment_id AS "equipmentId",p.ordinal,
  p.created_at AS "createdAt",p.updated_at AS "updatedAt",c.id AS "connectionId",
  ${connectionJson('c.company_id=p.company_id AND c.port_id=p.id')} AS connection
  FROM ports p LEFT JOIN connections c ON c.company_id=p.company_id AND c.port_id=p.id
  WHERE p.company_id=$1 AND p.equipment_id=$2 ORDER BY p.ordinal,p.id`;

export function registerRacks(app: FastifyInstance, pool: pg.Pool) {
  const path = '/api/companies/:companyId/units/:unitId/datacenters/:datacenterId/racks';
  const detail = `${path}/:rackId`, equipmentPath = `${detail}/equipment`, equipmentDetail = `${equipmentPath}/:equipmentId`;
  const portPath = `${equipmentDetail}/ports/:portId`;
  async function transaction<T>(work: (db: pg.PoolClient) => Promise<T>) {
    const db = await pool.connect();
    try { await db.query('BEGIN'); const result = await work(db); await db.query('COMMIT'); return result; }
    catch (error) {
      await db.query('ROLLBACK');
      const { code, constraint } = error as { code?: string; constraint?: string };
      if (code === '23P01') throw new HttpError(409, 'As U informadas já estão ocupadas por outro equipamento. Atualize o rack e escolha uma posição livre.');
      if (code === '23514' && constraint === 'equipment_capacity_check') throw new HttpError(409, 'Capacidade insuficiente: há equipamento fora das U disponíveis no rack.');
      if (code === '23503' || code === '23001') throw new HttpError(409, 'Cadastro com dependências ou contexto alterado. Remova as dependências explicitamente e atualize a lista.');
      throw error;
    } finally { db.release(); }
  }
  async function parent(db: pg.Pool | pg.PoolClient, p: Context) {
    if (!(await db.query('SELECT id FROM datacenters WHERE company_id=$1 AND unit_id=$2 AND id=$3', [p.companyId, p.unitId, p.datacenterId])).rowCount)
      throw new HttpError(404, 'Datacenter não encontrado nesta unidade.');
  }
  async function rack(db: pg.Pool | pg.PoolClient, p: Context, lock = false) {
    const result = await db.query(`SELECT ${rackFields} FROM racks r WHERE r.company_id=$1 AND r.unit_id=$2 AND r.datacenter_id=$3 AND r.id=$4 ${lock ? 'FOR UPDATE' : ''}`,
      [p.companyId, p.unitId, p.datacenterId, p.rackId]);
    if (!result.rowCount) throw new HttpError(404, 'Rack não encontrado neste datacenter.');
    return result.rows[0];
  }
  async function equipment(db: pg.Pool | pg.PoolClient, p: Context, lock = false) {
    const result = await db.query(`SELECT ${equipmentFields},${equipmentCount} FROM equipment e
      WHERE e.company_id=$1 AND e.rack_id=$2 AND e.id=$3 ${lock ? 'FOR UPDATE OF e' : ''}`, [p.companyId, p.rackId, p.equipmentId]);
    if (!result.rowCount) throw new HttpError(404, 'Equipamento não encontrado neste rack.');
    return result.rows[0];
  }
  async function equipmentList(db: pg.Pool | pg.PoolClient, p: Context) {
    const rows = (await db.query(`SELECT ${equipmentFields},${equipmentCount} FROM equipment e WHERE e.company_id=$1 AND e.rack_id=$2 ORDER BY e.start_u,e.id`, [p.companyId, p.rackId])).rows;
    const details = [];
    for (const row of rows) details.push({ ...row, ports: (await db.query(portsQuery, [p.companyId, row.id])).rows });
    return details;
  }
  async function checkPosition(db: pg.PoolClient, p: Context, capacity: number, start: number, height: number) {
    if (start + height - 1 > capacity) throw new HttpError(409, `Equipamento ocupa U ${start} a ${start + height - 1}, mas o rack tem ${capacity} U.`);
    if ((await db.query(`SELECT id FROM equipment WHERE company_id=$1 AND rack_id=$2 AND ($3::uuid IS NULL OR id<>$3)
      AND occupied_u && int8range($4::bigint,$5::bigint,'[)')`, [p.companyId, p.rackId, p.equipmentId, start, start + height])).rowCount)
      throw new HttpError(409, 'As U informadas já estão ocupadas por outro equipamento. Escolha uma posição livre.');
  }
  async function append(db: pg.PoolClient, p: Context, amount: number) {
    const rows = (await db.query('SELECT ordinal,name FROM ports WHERE company_id=$1 AND equipment_id=$2 ORDER BY ordinal', [p.companyId, p.equipmentId])).rows;
    let ordinal = rows.at(-1)?.ordinal ?? 0;
    if (ordinal + amount > rackLimits.ordinal) throw new HttpError(409, 'Limite da sequência de portas atingido.');
    const names = new Set(rows.map(row => row.name)), ordinals: number[] = [], labels: string[] = [];
    for (let i = 0; i < amount; i++) {
      ordinal++; let label = `Porta ${ordinal}`, suffix = ordinal;
      while (names.has(label)) label = `Porta ${++suffix}`;
      names.add(label); ordinals.push(ordinal); labels.push(label);
    }
    await db.query(`INSERT INTO ports(company_id,equipment_id,ordinal,name)
      SELECT $1,$2,v.ordinal,v.name FROM unnest($3::integer[],$4::text[]) v(ordinal,name)`, [p.companyId, p.equipmentId, ordinals, labels]);
  }
  async function fullEquipment(db: pg.PoolClient, p: Context) {
    const row = await equipment(db, p), ports = (await db.query(portsQuery, [p.companyId, p.equipmentId])).rows;
    return { ...row, portCount: ports.length, ports };
  }
  app.get<{ Params: Context }>(path, { config, schema: { params: params() } }, async request => {
    const p = request.params; await parent(pool, p);
    return { racks: (await pool.query(`SELECT ${rackFields},(SELECT count(*)::int FROM equipment e WHERE e.company_id=r.company_id AND e.rack_id=r.id) AS "equipmentCount"
      FROM racks r WHERE r.company_id=$1 AND r.unit_id=$2 AND r.datacenter_id=$3 ORDER BY r.name,r.id`, [p.companyId, p.unitId, p.datacenterId])).rows };
  });
  app.get<{ Params: Context }>(detail, { config, schema: { params: params(['rackId']) } }, request => transaction(async db => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const row = await rack(db, request.params), items = await equipmentList(db, request.params);
    return { ...row, equipmentCount: items.length, equipment: items };
  }));
  app.post<{ Params: Context; Body: RackInput }>(path, { config, schema: { params: params(), body: {
    type: 'object', required: ['name', 'capacityU'], additionalProperties: false, properties: { name, capacityU: units } } } }, async (request, reply) => {
    const row = await transaction(async db => {
      const p = request.params; await parent(db, p);
      const inserted = await db.query('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,$5) RETURNING id', [p.companyId, p.unitId, p.datacenterId, request.body.name, request.body.capacityU]);
      return { ...await rack(db, { ...p, rackId: inserted.rows[0].id }), equipmentCount: 0, equipment: [] };
    }); return reply.code(201).send(row);
  });
  app.patch<{ Params: Context; Body: Partial<RackInput> }>(detail, { config, schema: { params: params(['rackId']), body: {
    type: 'object', minProperties: 1, additionalProperties: false, properties: { name, capacityU: units } } } }, request => transaction(async db => {
    const p = request.params; await rack(db, p, true);
    if (request.body.capacityU !== undefined && (await db.query('SELECT id FROM equipment WHERE company_id=$1 AND rack_id=$2 AND start_u::bigint+height_u-1>$3', [p.companyId, p.rackId, request.body.capacityU])).rowCount)
      throw new HttpError(409, 'Não é possível reduzir a capacidade: há equipamentos acima da nova capacidade. Reposicione-os explicitamente primeiro.');
    await db.query('UPDATE racks SET name=coalesce($3,name),capacity_u=coalesce($4,capacity_u) WHERE company_id=$1 AND id=$2', [p.companyId, p.rackId, request.body.name ?? null, request.body.capacityU ?? null]);
    const items = await equipmentList(db, p); return { ...await rack(db, p), equipmentCount: items.length, equipment: items };
  }));
  app.delete<{ Params: Context }>(detail, { config, schema: { params: params(['rackId']) } }, async (request, reply) => {
    await transaction(async db => { const p = request.params; await rack(db, p, true);
      if ((await equipmentList(db, p)).length) throw new HttpError(409, 'Não é possível excluir: este rack possui equipamentos.');
      await db.query('DELETE FROM racks WHERE company_id=$1 AND id=$2', [p.companyId, p.rackId]);
    }); return reply.code(204).send();
  });
  app.get<{ Params: Context }>(equipmentDetail, { config, schema: { params: params(['rackId', 'equipmentId']) } }, request => transaction(async db => {
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); await rack(db, request.params); return fullEquipment(db, request.params);
  }));
  app.post<{ Params: Context; Body: EquipmentCreateInput }>(equipmentPath, { config, schema: { params: params(['rackId']), body: {
    type: 'object', required: ['name', 'kind', 'equipmentType', 'startU', 'heightU'], additionalProperties: false,
    properties: { name, kind: { enum: ['generic', 'patch_panel'] }, equipmentType: name, startU: units, heightU: units, portCount: count },
    allOf: [{ if: { properties: { kind: { const: 'patch_panel' } } }, then: { required: ['portCount'] }, else: { not: { required: ['portCount'] } } }] } } }, async (request, reply) => {
    const row = await transaction(async db => {
      const p = request.params, input = request.body, r = await rack(db, p, true);
      // Lock do rack serializa capacidade/escritas da API; EXCLUDE/FK continuam protegendo gravações diretas no banco.
      await checkPosition(db, p, r.capacityU, input.startU, input.heightU);
      const result = await db.query(`INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [p.companyId, p.rackId, input.name, input.kind, input.equipmentType, input.startU, input.heightU, r.capacityU]);
      const child = { ...p, equipmentId: result.rows[0].id };
      if (input.kind === 'patch_panel') await append(db, child, input.portCount!);
      return fullEquipment(db, child);
    }); return reply.code(201).send(row);
  });
  app.patch<{ Params: Context; Body: EquipmentUpdateInput }>(equipmentDetail, { config, bodyLimit: 32768, schema: { params: params(['rackId', 'equipmentId']), body: {
    type: 'object', minProperties: 1, additionalProperties: false, dependencies: { portCount: ['expectedPortIds'], expectedPortIds: ['portCount'] },
    properties: { name, equipmentType: name, startU: units, heightU: units, portCount: count,
      expectedPortIds: { type: 'array', maxItems: rackLimits.ports, uniqueItems: true, items: uuid } } } } }, request => transaction(async db => {
    const p = request.params, input = request.body, r = await rack(db, p, true), e = await equipment(db, p, true);
    await checkPosition(db, p, r.capacityU, input.startU ?? e.startU, input.heightU ?? e.heightU);
    if (input.portCount !== undefined) {
      if (e.kind !== 'patch_panel') throw new HttpError(400, 'Somente patch panels possuem portas.');
      const ports = (await db.query('SELECT id FROM ports WHERE company_id=$1 AND equipment_id=$2 ORDER BY ordinal,id FOR UPDATE', [p.companyId, p.equipmentId])).rows;
      if (!input.expectedPortIds || ports.length !== input.expectedPortIds.length || ports.some((row, i) => row.id !== input.expectedPortIds![i]))
        throw new HttpError(409, 'As portas foram alteradas. Atualize o equipamento antes de mudar a quantidade.');
      if (input.portCount < ports.length) {
        const removed = ports.slice(input.portCount).map(row => row.id);
        if ((await db.query('SELECT id FROM connections WHERE company_id=$1 AND port_id=ANY($2::uuid[])', [p.companyId, removed])).rowCount)
          throw new HttpError(409, 'Não é possível reduzir: uma das últimas portas possui conexão. Desvincule-a explicitamente primeiro.');
        await db.query('DELETE FROM ports WHERE company_id=$1 AND equipment_id=$2 AND id=ANY($3::uuid[])', [p.companyId, p.equipmentId, removed]);
      } else await append(db, p, input.portCount - ports.length);
    }
    await db.query(`UPDATE equipment SET name=coalesce($3,name),equipment_type=coalesce($4,equipment_type),start_u=coalesce($5,start_u),height_u=coalesce($6,height_u)
      WHERE company_id=$1 AND id=$2`, [p.companyId, p.equipmentId, input.name ?? null, input.equipmentType ?? null, input.startU ?? null, input.heightU ?? null]);
    return fullEquipment(db, p);
  }));
  app.delete<{ Params: Context }>(equipmentDetail, { config, schema: { params: params(['rackId', 'equipmentId']) } }, async (request, reply) => {
    await transaction(async db => {
      const p = request.params; await rack(db, p, true); const row = await equipment(db, p, true);
      if (row.portCount) throw new HttpError(409, 'Não é possível excluir: este equipamento possui portas. Remova as portas sem conexão primeiro.');
      await db.query('DELETE FROM equipment WHERE company_id=$1 AND id=$2', [p.companyId, p.equipmentId]);
    }); return reply.code(204).send();
  });
  app.patch<{ Params: Context; Body: { name: string } }>(portPath, { config, schema: { params: params(['rackId', 'equipmentId', 'portId']), body: {
    type: 'object', required: ['name'], additionalProperties: false, properties: { name } } } }, request => transaction(async db => {
    const p = request.params; await rack(db, p, true); await equipment(db, p, true);
    if (!(await db.query('UPDATE ports SET name=$4 WHERE company_id=$1 AND equipment_id=$2 AND id=$3 RETURNING id', [p.companyId, p.equipmentId, p.portId, request.body.name])).rowCount)
      throw new HttpError(404, 'Porta não encontrada neste equipamento.');
    return (await db.query(portsQuery, [p.companyId, p.equipmentId])).rows.find(row => row.id === p.portId);
  }));
  app.delete<{ Params: Context }>(portPath, { config, schema: { params: params(['rackId', 'equipmentId', 'portId']) } }, async (request, reply) => {
    await transaction(async db => {
      const p = request.params; await rack(db, p, true); await equipment(db, p, true);
      if (!(await db.query('DELETE FROM ports WHERE company_id=$1 AND equipment_id=$2 AND id=$3', [p.companyId, p.equipmentId, p.portId])).rowCount)
        throw new HttpError(404, 'Porta não encontrada neste equipamento.');
    }); return reply.code(204).send();
  });
}
