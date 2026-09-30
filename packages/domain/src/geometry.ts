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
      || Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) === 0) return false;
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
  if (value.background !== undefined) {
    const b = value.background;
    if (!record(b) || !identifier(b.originalFileId) || !identifier(b.renderedFileId)
      || !(b.page === null || (Number.isInteger(b.page) && (b.page as number) > 0))
      || !Number.isInteger(b.sourceWidthPx) || !positive(b.sourceWidthPx)
      || !Number.isInteger(b.sourceHeightPx) || !positive(b.sourceHeightPx)
      || !isRectangle(b.placement)) return false;
  }
  return true;
}
