import type { Desk, Point } from './entities.js';
import type { Rectangle } from './geometry.js';
import type { ConnectionDetail } from './connections.js';

export const deskLimits = { points: 512, ordinal: 2147483647, coordinate: 1000000, dimension: 10000 } as const;
export interface DeskSummary extends Desk { pointCount: number }
export interface DeskPoint extends Point { connectionId: string | null; connection: ConnectionDetail | null }
export interface DeskDetail extends DeskSummary { points: DeskPoint[] }
export interface DeskCreateInput { name: string; pointCount: number; placement?: Rectangle }
/** IDs na ordem exibida protegem alterações de quantidade feitas a partir de uma tela antiga. */
export interface DeskUpdateInput { name?: string; placement?: Rectangle; pointCount?: number; expectedPointIds?: string[] }
