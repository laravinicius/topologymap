/** Geometria v1: metros, origem livre, X à direita e Y para baixo.
 * Retângulos usam o centro como âncora e rotação horária em graus [0, 360).
 * Pixels, câmera, zoom, seleção e objetos do renderizador não são persistidos aqui.
 */
export interface Position { x: number; y: number }
export interface Rectangle extends Position { width: number; height: number; rotation: number }
export type Polygon = Position[];
export interface Wall { id: string; start: Position; end: Position; thickness: number }
export interface Opening {
  id: string; kind: 'door' | 'window'; wallId: string;
  /** Metros a partir do início da parede, no sentido start -> end. */
  offset: number; width: number;
}
export interface PlanBackground {
  originalFileId: string; renderedFileId: string; page: number | null;
  sourceWidthPx: number; sourceHeightPx: number; placement: Rectangle;
  /** Ausente em documentos antigos equivale a 1. */
  opacity?: number;
}
export interface PlanGeometry {
  version: 1; unit: 'm'; walls: Wall[]; openings: Opening[];
  background?: PlanBackground;
}
export const emptyPlanGeometry = (): PlanGeometry => ({ version: 1, unit: 'm', walls: [], openings: [] });

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export function isPosition(value: unknown): value is Position {
  return record(value) && finite(value.x) && finite(value.y);
}
export function isRectangle(value: unknown): value is Rectangle {
  return record(value) && isPosition(value) && positive(value.width) && positive(value.height)
    && finite(value.rotation) && value.rotation >= 0 && value.rotation < 360;
}
/** Polígono aberto: não repetir o primeiro vértice no fim. Mínimo de três vértices e área não nula. */
export function isPolygon(value: unknown): value is Polygon {
  if (!Array.isArray(value) || value.length < 3 || !value.every(isPosition)) return false;
  const keys = new Set(value.map(p => `${p.x},${p.y}`));
  if (keys.size !== value.length) return false;
  // Região simples: arestas não adjacentes não podem se cruzar ou tocar.
  const cross = (a: Position, b: Position, c: Position) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const on = (a: Position, b: Position, p: Position) => cross(a,b,p) === 0
    && p.x >= Math.min(a.x,b.x) && p.x <= Math.max(a.x,b.x) && p.y >= Math.min(a.y,b.y) && p.y <= Math.max(a.y,b.y);
  for (let i = 0; i < value.length; i++) {
    const a = value[i]!, b = value[(i+1)%value.length]!, c = value[(i+2)%value.length]!;
    if (cross(a,b,c) === 0 && ((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)) < 0) return false;
    for (let j = i+2; j < value.length; j++) {
      if (i === 0 && j === value.length-1) continue;
      const c = value[j]!, d = value[(j+1)%value.length]!;
      if ((Math.sign(cross(a,b,c))*Math.sign(cross(a,b,d)) < 0 && Math.sign(cross(c,d,a))*Math.sign(cross(c,d,b)) < 0)
        || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b)) return false;
    }
  }
  let area = 0;
  for (let i = 0; i < value.length; i++) {
    const a = value[i]!; const b = value[(i + 1) % value.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return Number.isFinite(area) && area !== 0;
}
export function isPlanGeometry(value: unknown): value is PlanGeometry {
  if (!record(value) || value.version !== 1 || value.unit !== 'm'
    || !Array.isArray(value.walls) || !Array.isArray(value.openings)) return false;
  const walls = new Map<string, Wall>();
  for (const wall of value.walls) {
    if (!record(wall) || !identifier(wall.id) || walls.has(wall.id)
      || !isPosition(wall.start) || !isPosition(wall.end) || !positive(wall.thickness)
      || !positive(Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y))) return false;
    walls.set(wall.id, wall as unknown as Wall);
  }
  const openingIds = new Set<string>();
  for (const opening of value.openings) {
    if (!record(opening) || !identifier(opening.id) || openingIds.has(opening.id)
      || (opening.kind !== 'door' && opening.kind !== 'window') || !identifier(opening.wallId)
      || !finite(opening.offset) || opening.offset < 0 || !positive(opening.width)) return false;
    const wall = walls.get(opening.wallId);
    if (!wall || opening.offset + opening.width > Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)) return false;
    openingIds.add(opening.id);
  }
  const openings = value.openings as Opening[];
  for (let i = 0; i < openings.length; i++) for (let j = i+1; j < openings.length; j++) {
    const a = openings[i]!, b = openings[j]!;
    if (a.wallId === b.wallId && a.offset < b.offset+b.width && b.offset < a.offset+a.width) return false;
  }
  if (value.background !== undefined) {
    const b = value.background;
    if (!record(b) || !identifier(b.originalFileId) || !identifier(b.renderedFileId)
      || !(b.page === null || (Number.isInteger(b.page) && (b.page as number) > 0))
      || !Number.isInteger(b.sourceWidthPx) || !positive(b.sourceWidthPx)
      || !Number.isInteger(b.sourceHeightPx) || !positive(b.sourceHeightPx)
      || (b.opacity !== undefined && (!finite(b.opacity) || b.opacity < 0 || b.opacity > 1))
      || !isRectangle(b.placement) || Math.abs(b.placement.x) > 1000000 || Math.abs(b.placement.y) > 1000000
      || Math.min(b.placement.width,b.placement.height) < .001 || Math.max(b.placement.width,b.placement.height) > 10000) return false;
  }
  return true;
}
