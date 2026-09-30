import type { AccessibleCompany } from './access.js';
import type { Unit, Floor, Plan, Datacenter } from './entities.js';

/** Metadados de cadastro; geometria e edição de layout têm fluxo próprio. */
export type ParkPlan = Pick<Plan, 'id' | 'name' | 'companyId' | 'unitId' | 'floorId' | 'createdAt' | 'updatedAt'>;
export type ParkDatacenter = Pick<Datacenter, 'id' | 'name' | 'companyId' | 'unitId' | 'createdAt' | 'updatedAt'>;
export interface ParkSnapshot {
  company: AccessibleCompany;
  units: Unit[];
  floors: Floor[];
  plans: ParkPlan[];
  datacenters: ParkDatacenter[];
}
export interface NamedInput { name: string }
/** Classificação livre; a interface oferece Matriz, Filial e CD como sugestões. */
export interface UnitInput extends NamedInput { classification: string }
