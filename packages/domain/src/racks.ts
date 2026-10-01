import type { Equipment, EquipmentKind, Port, Rack } from './entities.js';

/** Limites técnicos da API; a quantidade é contada pelos registros, nunca pelos nomes. */
export const rackLimits = { units: 1000, ports: 512, ordinal: 2147483647 } as const;
export interface RackSummary extends Rack { equipmentCount: number }
export interface EquipmentSummary extends Equipment { portCount: number }
export interface RackDetail extends RackSummary { equipment: EquipmentSummary[] }
export interface PortSummary extends Port { connectionId: string | null }
export interface EquipmentDetail extends EquipmentSummary { ports: PortSummary[] }
export interface RackInput { name: string; capacityU: number }
export interface EquipmentCreateInput {
  name: string; kind: EquipmentKind; equipmentType: string; startU: number; heightU: number; portCount?: number;
}
export interface EquipmentUpdateInput {
  name?: string; equipmentType?: string; startU?: number; heightU?: number;
  portCount?: number; expectedPortIds?: string[];
}
