import type pg from 'pg';

/** Exclusivamente para bancos descartáveis de teste; nunca chamado pelo servidor normal. */
export async function searchFixtures(pool: pg.Pool) {
  const insert = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0].id as string;
  const company = await insert('INSERT INTO companies(name) VALUES ($1) RETURNING id', ['Empresa sintética A']);
  const other = await insert('INSERT INTO companies(name) VALUES ($1) RETURNING id', ['Empresa sintética B']);
  const denied = await insert('INSERT INTO companies(name) VALUES ($1) RETURNING id', ['Empresa restrita']);
  const unit = await insert('INSERT INTO units(company_id,name,classification) VALUES ($1,$2,$3) RETURNING id', [company, 'Matriz QA', 'Matriz']);
  const floor = await insert('INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [company, unit, 'Andar mesas']);
  const rackFloor = await insert('INSERT INTO floors(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [company, unit, 'Andar racks']);
  const plan = await insert('INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4) RETURNING id', [company, unit, floor, 'Planta mesas']);
  const rackPlan = await insert('INSERT INTO plans(company_id,unit_id,floor_id,name) VALUES ($1,$2,$3,$4) RETURNING id', [company, unit, rackFloor, 'Planta racks']);
  const sector = await insert('INSERT INTO sectors(company_id,plan_id,name,polygon) VALUES ($1,$2,$3,$4) RETURNING id', [company, plan, 'Atendimento', JSON.stringify([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }])]);
  const desk = await insert('INSERT INTO desks(company_id,plan_id,sector_id,name,placement) VALUES ($1,$2,$3,$4,$5) RETURNING id', [company, plan, sector, 'Mesa 01', JSON.stringify({ x: 3, y: 4, width: 1.2, height: .6, rotation: 0 })]);
  const deskTwo = await insert('INSERT INTO desks(company_id,plan_id,name) VALUES ($1,$2,$3) RETURNING id', [company, rackPlan, 'Mesa 01']);
  const points: string[] = [];
  for (let n = 1; n <= 8; n++) points.push(await insert('INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,$3,$4) RETURNING id', [company, desk, `Ponto ${n}`, n]));
  const reversePoint = await insert('INSERT INTO points(company_id,desk_id,name,ordinal) VALUES ($1,$2,$3,1) RETURNING id', [company, deskTwo, 'Ponto inverso']);
  const dc1 = await insert('INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [company, unit, 'Datacenter 01']);
  const dc2 = await insert('INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [company, unit, 'Datacenter 02']);
  const rack1 = await insert('INSERT INTO racks(company_id,unit_id,datacenter_id,plan_id,placement,name,capacity_u) VALUES ($1,$2,$3,$4,$5,$6,12) RETURNING id', [company, unit, dc1, rackPlan, JSON.stringify({ x: 15, y: 6, width: .6, height: 1, rotation: 90 }), 'Rack 01']);
  const rack2 = await insert('INSERT INTO racks(company_id,unit_id,datacenter_id,plan_id,name,capacity_u) VALUES ($1,$2,$3,$4,$5,12) RETURNING id', [company, unit, dc2, plan, 'Rack 01']);
  const orphanRack = await insert('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,12) RETURNING id', [company, unit, dc2, 'Rack sem planta']);
  const panels: string[] = [], ports: string[][] = [];
  for (const rack of [rack1, rack2, orphanRack]) {
    const panel = await insert("INSERT INTO equipment(company_id,rack_id,name,kind,equipment_type,start_u,height_u,rack_capacity_u) VALUES ($1,$2,$3,'patch_panel','Cat6',1,1,12) RETURNING id", [company, rack, 'Patch panel 01']);
    panels.push(panel); const list: string[] = [];
    for (let n = 1; n <= 4; n++) list.push(await insert('INSERT INTO ports(company_id,equipment_id,name,ordinal) VALUES ($1,$2,$3,$4) RETURNING id', [company, panel, `Porta ${n}`, n]));
    ports.push(list);
  }
  const connections: string[] = [];
  for (const [point, port] of [[points[0], ports[0]![0]], [points[1], ports[1]![0]], [reversePoint, ports[1]![1]]])
    connections.push(await insert('INSERT INTO connections(company_id,point_id,port_id) VALUES ($1,$2,$3) RETURNING id', [company, point, port]));
  const otherUnit = await insert('INSERT INTO units(company_id,name,classification) VALUES ($1,$2,$3) RETURNING id', [other, 'Filial B', 'Filial']);
  const otherDc = await insert('INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [other, otherUnit, 'DC B']);
  const otherRack = await insert('INSERT INTO racks(company_id,unit_id,datacenter_id,name,capacity_u) VALUES ($1,$2,$3,$4,12) RETURNING id', [other, otherUnit, otherDc, 'Rack B']);
  const deniedUnit = await insert('INSERT INTO units(company_id,name,classification) VALUES ($1,$2,$3) RETURNING id', [denied, 'Unidade oculta', 'Matriz']);
  const deniedDc = await insert('INSERT INTO datacenters(company_id,unit_id,name) VALUES ($1,$2,$3) RETURNING id', [denied, deniedUnit, 'DC oculto']);
  return { company, other, denied, unit, floor, rackFloor, plan, rackPlan, sector, desk, deskTwo, points, reversePoint,
    dc1, dc2, rack1, rack2, orphanRack, panels, ports, connections, otherUnit, otherDc, otherRack, deniedUnit, deniedDc };
}
