/** Fragmento interno: somente expressões fixas do código, nunca valores da requisição. */
const named = (alias: string) => `jsonb_build_object('id',${alias}.id,'name',${alias}.name)`;
const optional = (alias: string) => `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE ${named(alias)} END`;

export function connectionJson(condition: string) {
  return `(SELECT jsonb_build_object(
    'id',c.id,'companyId',c.company_id,'pointId',c.point_id,'portId',c.port_id,
    'revision',c.revision,'createdAt',c.created_at,'updatedAt',c.updated_at,
    'path',jsonb_build_object('company',${named('co')},
      'origin',jsonb_build_object('unit',${named('ou')},'floor',${named('ofl')},'plan',${named('op')},
        'sector',${optional('s')},'desk',${named('d')},'point',${named('pt')}),
      'destination',jsonb_build_object('unit',${named('du')},'datacenter',${named('dc')},'rack',${named('r')},
        'plan',${optional('dp')},'floor',${optional('dfl')},'patchPanel',${named('e')},'port',${named('po')})))
    FROM connections c
    JOIN companies co ON co.id=c.company_id
    JOIN points pt ON pt.company_id=c.company_id AND pt.id=c.point_id
    JOIN desks d ON d.company_id=c.company_id AND d.id=pt.desk_id
    JOIN plans op ON op.company_id=c.company_id AND op.id=d.plan_id
    JOIN floors ofl ON ofl.company_id=c.company_id AND ofl.id=op.floor_id
    JOIN units ou ON ou.company_id=c.company_id AND ou.id=op.unit_id
    LEFT JOIN sectors s ON s.company_id=c.company_id AND s.id=d.sector_id
    JOIN ports po ON po.company_id=c.company_id AND po.id=c.port_id
    JOIN equipment e ON e.company_id=c.company_id AND e.id=po.equipment_id AND e.kind='patch_panel'
    JOIN racks r ON r.company_id=c.company_id AND r.id=e.rack_id
    JOIN datacenters dc ON dc.company_id=c.company_id AND dc.id=r.datacenter_id
    JOIN units du ON du.company_id=c.company_id AND du.id=r.unit_id
    LEFT JOIN plans dp ON dp.company_id=c.company_id AND dp.id=r.plan_id
    LEFT JOIN floors dfl ON dfl.company_id=c.company_id AND dfl.id=dp.floor_id
    WHERE ${condition})`;
}
