import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { searchKinds, type SearchKind, type SearchResponse, type SearchResult } from '@topologia-new/domain';
import { companyAccess, HttpError } from '../auth/authorization.js';
import { uuid } from '../admin/routes.js';

// Somente aliases e expressões fixas, sem interpolação de entradas do usuário.
const target = (desk = 'NULL', point = 'NULL', dc = 'NULL', rack = 'NULL', equipment = 'NULL', port = 'NULL', sector = 'NULL') =>
  `jsonb_build_object('companyId',co.id,'unitId',u.id,'floorId',fl.id,'planId',pl.id,'sectorId',${sector},
    'deskId',${desk},'pointId',${point},'datacenterId',${dc},'rackId',${rack},'equipmentId',${equipment},'portId',${port})`;
const columns = (kind: SearchKind, alias: string, location: string, positioned: string, refs: string) =>
  `SELECT '${kind}'::text AS kind,${alias}.id,${alias}.name,${location} AS context,${positioned} AS positioned,${refs} AS target`;
const path = (...aliases: string[]) => `concat_ws(' / ',${aliases.map(a => `${a}.name`).join(',')})`;
const planParents = `JOIN plans pl ON pl.id=d.plan_id AND pl.company_id=d.company_id
  JOIN floors fl ON fl.id=pl.floor_id JOIN units u ON u.id=pl.unit_id JOIN authorized co ON co.id=pl.company_id`;
const rackParents = `JOIN datacenters dc ON dc.id=r.datacenter_id AND dc.company_id=r.company_id
  JOIN units u ON u.id=r.unit_id JOIN authorized co ON co.id=r.company_id
  LEFT JOIN plans pl ON pl.id=r.plan_id LEFT JOIN floors fl ON fl.id=pl.floor_id`;
/** Mesmo SELECT para a busca e a resolução de URLs: nenhuma cópia de cadastros/conexões. */
const catalog = [
  `${columns('plan', 'pl', path('co', 'u', 'fl'), 'true', target())}
    FROM plans pl JOIN floors fl ON fl.id=pl.floor_id JOIN units u ON u.id=pl.unit_id JOIN authorized co ON co.id=pl.company_id`,
  `${columns('desk', 'd', path('co', 'u', 'fl', 'pl', 's'), 'true', target('d.id', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'd.sector_id'))}
    FROM desks d ${planParents} LEFT JOIN sectors s ON s.id=d.sector_id`,
  `${columns('point', 'pt', path('co', 'u', 'fl', 'pl', 's', 'd'), 'true', target('d.id', 'pt.id', 'NULL', 'NULL', 'NULL', 'NULL', 'd.sector_id'))}
    FROM points pt JOIN desks d ON d.id=pt.desk_id AND d.company_id=pt.company_id ${planParents} LEFT JOIN sectors s ON s.id=d.sector_id`,
  `${columns('datacenter', 'dc', path('co', 'u', 'fl', 'pl'), 'dc.placement IS NOT NULL', target('NULL', 'NULL', 'dc.id'))}
    FROM datacenters dc JOIN units u ON u.id=dc.unit_id JOIN authorized co ON co.id=dc.company_id
    LEFT JOIN plans pl ON pl.id=dc.plan_id LEFT JOIN floors fl ON fl.id=pl.floor_id`,
  `${columns('rack', 'r', path('co', 'u', 'fl', 'pl', 'dc'), 'r.placement IS NOT NULL', target('NULL', 'NULL', 'dc.id', 'r.id'))} FROM racks r ${rackParents}`,
  `${columns('patch_panel', 'e', path('co', 'u', 'fl', 'pl', 'dc', 'r'), 'r.placement IS NOT NULL', target('NULL', 'NULL', 'dc.id', 'r.id', 'e.id'))}
    FROM equipment e JOIN racks r ON r.id=e.rack_id AND r.company_id=e.company_id ${rackParents} WHERE e.kind='patch_panel'`,
  `${columns('port', 'po', path('co', 'u', 'fl', 'pl', 'dc', 'r', 'e'), 'r.placement IS NOT NULL', target('NULL', 'NULL', 'dc.id', 'r.id', 'e.id', 'po.id'))}
    FROM ports po JOIN equipment e ON e.id=po.equipment_id AND e.company_id=po.company_id
    JOIN racks r ON r.id=e.rack_id AND r.company_id=e.company_id ${rackParents}`,
].join(' UNION ALL ');
const authorized = `WITH authorized AS (SELECT c.id,c.name FROM companies c JOIN users usr ON usr.id=$1 AND usr.is_active
  LEFT JOIN company_permissions permission ON permission.company_id=c.id AND permission.user_id=usr.id
  WHERE (usr.is_admin OR permission.role IS NOT NULL))`;
const cte = `${authorized}, catalog AS (${catalog})`;
type Filters = { q?: string; companyId?: string; unitId?: string; floorId?: string; sectorId?: string; kind?: SearchKind; offset?: string };

export function registerSearch(app: FastifyInstance, pool: pg.Pool) {
  app.get<{ Querystring: Filters }>('/api/search', { config: { access: 'session' }, schema: { querystring: {
    type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 200 }, companyId: uuid, unitId: uuid, floorId: uuid, sectorId: uuid,
      kind: { type: 'string', enum: [...searchKinds] }, offset: { type: 'string', pattern: '^(0|[1-9][0-9]{0,6})$' },
    },
  } } }, async request => {
    const f = request.query;
    if (f.companyId) await companyAccess(pool, request, f.companyId);
    // Filiações incompatíveis são erro explícito; IDs não autorizados têm a mesma resposta que inexistentes.
    for (const [id, sql, values] of [
      [f.unitId, 'SELECT u.id FROM units u JOIN authorized co ON co.id=u.company_id WHERE u.id=$2 AND ($3::uuid IS NULL OR u.company_id=$3)', [f.unitId, f.companyId ?? null]],
      [f.floorId, 'SELECT f.id FROM floors f JOIN authorized co ON co.id=f.company_id WHERE f.id=$2 AND ($3::uuid IS NULL OR f.company_id=$3) AND ($4::uuid IS NULL OR f.unit_id=$4)', [f.floorId, f.companyId ?? null, f.unitId ?? null]],
      [f.sectorId, 'SELECT s.id FROM sectors s JOIN plans p ON p.id=s.plan_id JOIN authorized co ON co.id=s.company_id WHERE s.id=$2 AND ($3::uuid IS NULL OR s.company_id=$3) AND ($4::uuid IS NULL OR p.unit_id=$4) AND ($5::uuid IS NULL OR p.floor_id=$5)', [f.sectorId, f.companyId ?? null, f.unitId ?? null, f.floorId ?? null]],
    ] as const) {
      if (id) {
        const result = await pool.query(`${authorized} ${sql}`, [request.session!.user.id, ...values]);
        if (!result.rowCount) throw new HttpError(404, 'Filtro não encontrado, incompatível ou sem acesso.');
      }
    }
    const values = [request.session!.user.id, f.companyId ?? null, f.unitId ?? null, f.floorId ?? null, f.sectorId ?? null,
      f.kind ?? null, `%${(f.q ?? '').trim().replace(/[\\%_]/g, '\\$&')}%`, Number(f.offset ?? 0)];
    const where = `($2::uuid IS NULL OR (target->>'companyId')::uuid=$2) AND ($3::uuid IS NULL OR (target->>'unitId')::uuid=$3)
      AND ($4::uuid IS NULL OR (target->>'floorId')::uuid=$4) AND ($5::uuid IS NULL OR (target->>'sectorId')::uuid=$5)
      AND ($6::text IS NULL OR kind=$6) AND name ILIKE $7`;
    const result = await pool.query(`${cte}, matched AS (SELECT * FROM catalog WHERE ${where})
      SELECT (SELECT count(*)::int FROM matched) AS total,
      coalesce((SELECT jsonb_agg(row) FROM (SELECT * FROM matched ORDER BY lower(name),kind,id LIMIT 50 OFFSET $8) row),'[]') AS results,
      jsonb_build_object(
        'units',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row.id) FROM (SELECT u.id,u.name,co.name AS context,u.company_id AS "companyId",u.id AS "unitId" FROM units u JOIN authorized co ON co.id=u.company_id WHERE ($2::uuid IS NULL OR co.id=$2::uuid)) row),'[]'),
        'floors',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row.id) FROM (SELECT f.id,f.name,concat_ws(' / ',co.name,u.name) AS context,f.company_id AS "companyId",f.unit_id AS "unitId" FROM floors f JOIN units u ON u.id=f.unit_id JOIN authorized co ON co.id=f.company_id WHERE ($2::uuid IS NULL OR co.id=$2::uuid) AND ($3::uuid IS NULL OR f.unit_id=$3::uuid)) row),'[]'),
        'sectors',coalesce((SELECT jsonb_agg(row ORDER BY row.name,row.id) FROM (SELECT s.id,s.name,concat_ws(' / ',co.name,u.name,fl.name,p.name) AS context,s.company_id AS "companyId",p.unit_id AS "unitId",p.floor_id AS "floorId",s.plan_id AS "planId" FROM sectors s JOIN plans p ON p.id=s.plan_id JOIN units u ON u.id=p.unit_id JOIN floors fl ON fl.id=p.floor_id JOIN authorized co ON co.id=s.company_id WHERE ($2::uuid IS NULL OR co.id=$2::uuid) AND ($3::uuid IS NULL OR p.unit_id=$3::uuid) AND ($4::uuid IS NULL OR p.floor_id=$4::uuid)) row),'[]')
      ) AS facets`, values);
    return { ...result.rows[0], offset: Number(f.offset ?? 0), limit: 50 } satisfies SearchResponse;
  });
  app.get<{ Params: { companyId: string; kind: SearchKind; id: string } }>('/api/companies/:companyId/locate/:kind/:id', {
    config: { access: 'company' }, schema: { params: { type: 'object', required: ['companyId', 'kind', 'id'], additionalProperties: false,
      properties: { companyId: uuid, id: uuid, kind: { type: 'string', enum: [...searchKinds] } } } },
  }, async request => {
    const result = await pool.query(`${cte} SELECT * FROM catalog WHERE target->>'companyId'=$2 AND kind=$3 AND id=$4`,
      [request.session!.user.id, request.company!.id, request.params.kind, request.params.id]);
    if (!result.rowCount) throw new HttpError(404, 'Objeto não encontrado neste contexto.');
    return result.rows[0] as SearchResult;
  });
}
