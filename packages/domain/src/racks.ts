import type { Equipment, EquipmentKind, Port, Rack } from './entities.js';
import type { ConnectionDetail } from './connections.js';

/** Limites técnicos da API; a quantidade é contada pelos registros, nunca pelos nomes. */
export const rackLimits = { units: 1000, ports: 512, ordinal: 2147483647 } as const;
export interface RackSummary extends Rack { equipmentCount: number }
export interface EquipmentSummary extends Equipment { portCount: number }
export interface PortSummary extends Port { connectionId: string | null; connection: ConnectionDetail | null }
export interface EquipmentDetail extends EquipmentSummary { ports: PortSummary[] }
export interface RackDetail extends RackSummary { equipment: EquipmentDetail[] }
export interface RackInput { name: string; capacityU: number }
export interface EquipmentCreateInput {
  name: string; kind: EquipmentKind; equipmentType: string; startU: number; heightU: number; portCount?: number;
}
export interface EquipmentUpdateInput {
  name?: string; equipmentType?: string; startU?: number; heightU?: number;
  portCount?: number; expectedPortIds?: string[];
}
