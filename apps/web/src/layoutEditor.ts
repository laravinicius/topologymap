import type { LayoutCamera, PlanLayout, Rectangle } from '@topologia-new/domain';

export const pixelsPerMeter = 80;
export const normalizeRotation = (value: number) => ((value % 360) + 360) % 360;
export const rounded = (value: number) => Math.round(value * 10000) / 10000;
export type Placements = Pick<PlanLayout, 'desks' | 'racks'>;
export const placements = (layout: PlanLayout): Placements => structuredClone({ desks: layout.desks, racks: layout.racks });
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type Drawing = Pick<PlanLayout, 'geometry' | 'desks' | 'racks' | 'sectors'>;
export const drawing = (layout: PlanLayout): Drawing => structuredClone({ geometry: layout.geometry, desks: layout.desks, racks: layout.racks, sectors: layout.sectors });
/** Histórico do desenho: não inclui câmera, cadastros de mesas ou cabeamento. */
export function applyDrawing(layout: PlanLayout, value: Drawing): PlanLayout {
  const next = applyPlacements(layout, value);
  next.geometry = structuredClone(value.geometry); next.sectors = structuredClone(value.sectors);
  next.desks = next.desks.map(item => {
    const old = value.desks.find(d => d.id === item.id);
    return old ? { ...item, ...(old.sectorId === undefined ? {} : { sectorId: old.sectorId }) } : item;
  });
  return next;
}
export function removeDrawingItem(layout: PlanLayout, id: string): PlanLayout {
  const next = structuredClone(layout);
  next.geometry.walls = next.geometry.walls.filter(item => item.id !== id);
  next.geometry.openings = next.geometry.openings.filter(item => item.id !== id && item.wallId !== id);
  next.sectors = next.sectors.filter(item => item.id !== id);
  next.desks = next.desks.map(item => item.sectorId === id ? { ...item, sectorId: null } : item);
  return next;
}

export function drawingBounds(layout: PlanLayout): Rectangle[] {
  const points = [...layout.geometry.walls.flatMap(w => [w.start,w.end]), ...layout.sectors.flatMap(s => s.polygon)];
  return [...layout.desks.map(d => d.placement), ...layout.racks.flatMap(r => r.placement ? [r.placement] : []),
    ...(layout.geometry.background ? [layout.geometry.background.placement] : []),
    ...points.map(p => ({ ...p, width: .2, height: .2, rotation: 0 }))];
}

/** Só aplica posições a membros existentes; histórico nunca insere um cadastro. */
export function applyPlacements(layout: PlanLayout, values: Placements): PlanLayout {
  return { ...layout,
    desks: layout.desks.map(item => ({ ...item, placement: values.desks.find(value => value.id === item.id)?.placement ?? item.placement })),
    racks: layout.racks.map(item => {
      const value = values.racks.find(value => value.id === item.id);
      return value ? { ...item, placement: value.placement } : item;
    }),
  };
}

/** Reconciliação explícita: somente posições editadas sobrevivem, para IDs ainda presentes. */
export function reconcile(latest: PlanLayout, baseline: PlanLayout, local: PlanLayout): PlanLayout {
  const result = structuredClone(latest);
  for (const kind of ['desks', 'racks'] as const) {
    for (const item of result[kind]) {
      const old = baseline[kind].find(value => value.id === item.id);
      const edited = local[kind].find(value => value.id === item.id);
      if (old && edited && !same(old.placement, edited.placement)) item.placement = structuredClone(edited.placement)!;
    }
  }
  if (!same(baseline.camera, local.camera)) result.camera = { ...local.camera };
  return result;
}

export function fitCamera(rectangles: Rectangle[], width: number, height: number): LayoutCamera {
  if (!rectangles.length) return { x: width / 2, y: height / 2, zoom: 1 };
  const corners = rectangles.flatMap(r => {
    const angle = r.rotation * Math.PI / 180;
    return [-1, 1].flatMap(x => [-1, 1].map(y => ({
      x: (r.x + x * r.width / 2 * Math.cos(angle) - y * r.height / 2 * Math.sin(angle)) * pixelsPerMeter,
      y: (r.y + x * r.width / 2 * Math.sin(angle) + y * r.height / 2 * Math.cos(angle)) * pixelsPerMeter,
    })));
  });
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.y)), bottom = Math.max(...corners.map(p => p.y));
  // Margem também acomoda a alça de rotação, que fica 50 px fora do objeto.
  const zoom = Math.max(.05, Math.min(8, Math.max(1, width - 160) / Math.max(1, right - left), Math.max(1, height - 160) / Math.max(1, bottom - top)));
  return { x: width / 2 - (left + right) / 2 * zoom, y: height / 2 - (top + bottom) / 2 * zoom, zoom };
}
