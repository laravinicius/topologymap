import { isPlanGeometry, isPolygon, isRectangle, type PlanGeometry, type Polygon, type Rectangle } from './geometry.js';

/** Câmera do cliente em pixels, separada das coordenadas métricas dos objetos. */
export interface LayoutCamera { x: number; y: number; zoom: number }
export interface LayoutDesk { id: string; placement: Rectangle; sectorId?: string | null }
export interface LayoutRack { id: string; placement: Rectangle | null }
export interface LayoutSector { id: string; polygon: Polygon; name?: string }
export interface PlanLayout {
  version: 1;
  unit: 'm';
  geometry: PlanGeometry;
  camera: LayoutCamera;
  desks: LayoutDesk[];
  racks: LayoutRack[];
  sectors: LayoutSector[];
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fields = (value: object, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const positionFields = (value: object) => fields(value, ['x', 'y']);
const rectangleFields = (value: object) => fields(value, ['x', 'y', 'width', 'height', 'rotation']);
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function uniqueItems<T extends { id: string }>(items: unknown, validate: (item: unknown) => item is T): items is T[] {
  if (!Array.isArray(items)) return false;
  const ids = new Set<string>();
  for (const item of items) {
    if (!validate(item) || ids.has(item.id.toLowerCase())) return false;
    ids.add(item.id.toLowerCase());
  }
  return true;
}

export function isPlanLayout(value: unknown): value is PlanLayout {
  if (!object(value) || value.version !== 1 || value.unit !== 'm' || !isPlanGeometry(value.geometry)
    || !object(value.camera) || !Number.isFinite(value.camera.x) || !Number.isFinite(value.camera.y)
    || !Number.isFinite(value.camera.zoom) || (value.camera.zoom as number) <= 0) return false;
  if (!fields(value, ['version', 'unit', 'geometry', 'camera', 'desks', 'racks', 'sectors'])
    || !fields(value.camera, ['x', 'y', 'zoom'])
    || !fields(value.geometry, ['version', 'unit', 'walls', 'openings', 'background'])
    || !value.geometry.walls.every(wall => fields(wall, ['id', 'start', 'end', 'thickness']) && positionFields(wall.start) && positionFields(wall.end))
    || !value.geometry.openings.every(opening => fields(opening, ['id', 'kind', 'wallId', 'offset', 'width']))) return false;
  const background = value.geometry.background;
  if (background && (!fields(background, ['originalFileId', 'renderedFileId', 'page', 'sourceWidthPx', 'sourceHeightPx', 'placement'])
    || !rectangleFields(background.placement))) return false;
  const valid = uniqueItems(value.desks, (item): item is LayoutDesk => object(item) && fields(item, ['id', 'placement', 'sectorId'])
      && (item.sectorId === undefined || item.sectorId === null || id(item.sectorId))
      && id(item.id) && isRectangle(item.placement) && rectangleFields(item.placement))
    && uniqueItems(value.racks, (item): item is LayoutRack => object(item) && id(item.id)
      && fields(item, ['id', 'placement']) && (item.placement === null || (isRectangle(item.placement) && rectangleFields(item.placement))))
    && uniqueItems(value.sectors, (item): item is LayoutSector => object(item) && fields(item, ['id', 'polygon', 'name'])
      && (item.name === undefined || (typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 200))
      && id(item.id) && isPolygon(item.polygon) && item.polygon.every(positionFields));
  if (!valid) return false;
  const sectors = new Set((value.sectors as LayoutSector[]).map(item => item.id.toLowerCase()));
  if ((value.desks as LayoutDesk[]).some(item => item.sectorId && !sectors.has(item.sectorId.toLowerCase()))) return false;
  const objectIds = [...value.desks as LayoutDesk[], ...value.racks as LayoutRack[], ...value.sectors as LayoutSector[],
    ...value.geometry.walls, ...value.geometry.openings].map(item => item.id.toLowerCase());
  return new Set(objectIds).size === objectIds.length;
}
