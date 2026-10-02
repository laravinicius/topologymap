import type { LayoutCamera, Position } from '@topologia-new/domain';

export function touchCamera(camera: LayoutCamera, previous: Position[], current: Position[]): LayoutCamera {
  if (!previous.length || previous.length !== current.length) return camera;
  const center = (points: Position[]) => points.length > 1
    ? { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 } : points[0]!;
  const before = center(previous), after = center(current);
  const distance = (points: Position[]) => Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
  const ratio = current.length > 1 && distance(previous) > 0 ? distance(current) / distance(previous) : 1;
  const zoom = Math.max(.05, Math.min(8, camera.zoom * ratio));
  return { zoom, x: after.x - (before.x - camera.x) / camera.zoom * zoom,
    y: after.y - (before.y - camera.y) / camera.zoom * zoom };
}
