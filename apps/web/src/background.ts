import type { PlanBackground, Position } from '@topologia-new/domain';

export function sourceToWorld(b: PlanBackground, p: Position): Position {
  const r = b.placement, angle = r.rotation*Math.PI/180;
  const x = (p.x/b.sourceWidthPx-.5)*r.width, y = (p.y/b.sourceHeightPx-.5)*r.height;
  return { x: r.x+x*Math.cos(angle)-y*Math.sin(angle), y: r.y+x*Math.sin(angle)+y*Math.cos(angle) };
}
export function worldToSource(b: PlanBackground, p: Position): Position {
  const r = b.placement, angle = -r.rotation*Math.PI/180, x = p.x-r.x, y = p.y-r.y;
  return { x: ((x*Math.cos(angle)-y*Math.sin(angle))/r.width+.5)*b.sourceWidthPx,
    y: ((x*Math.sin(angle)+y*Math.cos(angle))/r.height+.5)*b.sourceHeightPx };
}
export function calibrateBackground(b: PlanBackground, a: Position, c: Position, meters: number): PlanBackground {
  if (![a,c].every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= b.sourceWidthPx && p.y <= b.sourceHeightPx)
    || !Number.isFinite(meters) || meters <= 0 || meters > 10000) throw new Error('Pontos devem estar na imagem; distância deve ser maior que zero e até 10000 m.');
  const first = sourceToWorld(b,a), second = sourceToWorld(b,c), distance = Math.hypot(second.x-first.x,second.y-first.y);
  if (Math.hypot(c.x-a.x,c.y-a.y) < 1 || distance <= 0) throw new Error('Escolha pontos separados por pelo menos um pixel.');
  const factor = meters/distance;
  const placement = { ...b.placement, width: b.placement.width*factor, height: b.placement.height*factor };
  if (Math.min(placement.width,placement.height) < .001 || Math.max(placement.width,placement.height) > 10000)
    throw new Error('Dimensões calibradas devem ficar entre 0,001 e 10000 m.');
  // Mantém o primeiro ponto no lugar; transforma apenas o fundo.
  placement.x = first.x+(b.placement.x-first.x)*factor;
  placement.y = first.y+(b.placement.y-first.y)*factor;
  return { ...b, placement };
}
