import type { PlanGeometry, Polygon, Rectangle } from './geometry.js';

/** UUID persistido; nomes e caminhos nunca são identificadores. Datas em ISO 8601 UTC. */
export type EntityId = string;
export type Timestamp = string;
export interface Entity { id: EntityId; createdAt: Timestamp; updatedAt: Timestamp }
export interface NamedEntity extends Entity { name: string }
export interface CompanyEntity extends NamedEntity { companyId: EntityId }
export type CompanyRole = 'manager' | 'viewer';
export type EquipmentKind = 'generic' | 'patch_panel';

/** Contrato interno de persistência. Não expor passwordHash/sessionTokenHash em respostas. */
export interface User extends Entity {
  login: string; name: string; passwordHash: string; isAdmin: boolean; isActive: boolean;
}
export interface Session {
  id: EntityId; userId: EntityId; sessionTokenHash: string;
  createdAt: Timestamp; expiresAt: Timestamp; revokedAt: Timestamp | null;
}
export interface Company extends NamedEntity {}
export interface CompanyPermission extends Entity {
  userId: EntityId; companyId: EntityId; role: CompanyRole;
}
export interface Unit extends CompanyEntity { classification: string }
export interface Floor extends CompanyEntity { unitId: EntityId }
export interface Plan extends CompanyEntity {
  unitId: EntityId; floorId: EntityId; revision: number; geometry: PlanGeometry;
}
export interface Sector extends CompanyEntity { planId: EntityId; polygon: Polygon }
export interface Desk extends CompanyEntity {
  planId: EntityId; sectorId: EntityId | null; placement: Rectangle;
}
export interface Point extends CompanyEntity { deskId: EntityId; ordinal: number }
export interface Datacenter extends CompanyEntity {
  unitId: EntityId; planId: EntityId | null; placement: Rectangle | null;
}
export interface Rack extends CompanyEntity {
  unitId: EntityId; datacenterId: EntityId; planId: EntityId | null;
  capacityU: number; placement: Rectangle | null;
}
export interface Equipment extends CompanyEntity {
  rackId: EntityId; kind: EquipmentKind; equipmentType: string;
  startU: number; heightU: number;
}
export interface Port extends CompanyEntity { equipmentId: EntityId; ordinal: number }
/** Única relação persistida. O caminho é consultado pelos IDs e nomes atuais. */
export interface Connection extends Entity {
  companyId: EntityId; pointId: EntityId; portId: EntityId; revision: number;
}
