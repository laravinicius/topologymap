import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Stage, Layer, Group, Rect, Text, Line, Circle, Transformer } from 'react-konva';
import type { LayoutCamera, PlanLayout, Position, Rectangle } from '@topologia-new/domain';
import { normalizeRotation, pixelsPerMeter as ppm, rounded } from './layoutEditor';

export interface CanvasObject { id: string; name: string; kind: 'desks' | 'racks'; placement: Rectangle | null }

function ObjectShape({ item, selected, editable, snap, choose, change }: {
  item: CanvasObject; selected: boolean; editable: boolean; snap: boolean;
  choose: () => void; change: (placement: Rectangle) => void;
}) {
  const shape = useRef<Konva.Group>(null), transformer = useRef<Konva.Transformer>(null);
  const r = item.placement!;
  useEffect(() => {
    if (selected && editable && transformer.current && shape.current) transformer.current.nodes([shape.current]);
  }, [selected, editable, r]);
  function commit() {
    const node = shape.current!;
    const width = Math.max(.05, r.width * node.scaleX()), height = Math.max(.05, r.height * node.scaleY());
    const quantize = (value: number) => rounded(snap ? Math.round(value / .25) * .25 : value);
    const placement = { x: quantize(node.x() / ppm), y: quantize(node.y() / ppm), width: rounded(width), height: rounded(height), rotation: rounded(normalizeRotation(node.rotation())) % 360 };
    // O valor ajustado pode ser igual à prop anterior. Sincronizar também o node
    // evita que o modo não estrito do react-konva mantenha uma posição transitória.
    const canonical = editable ? placement : r;
    node.setAttrs({ x: canonical.x * ppm, y: canonical.y * ppm, rotation: canonical.rotation, scaleX: 1, scaleY: 1 });
    if (editable) change(placement);
  }
  return <>
    <Group ref={shape} x={r.x * ppm} y={r.y * ppm} rotation={r.rotation} draggable={editable}
      onClick={choose} onTap={choose} onDragStart={choose} onDragEnd={commit} onTransformEnd={commit}
      dragBoundFunc={position => {
        if (!snap) return position;
        const stage = shape.current?.getStage();
        if (!stage) return position;
        const scale = stage.scaleX(), step = .25 * ppm;
        return { x: stage.x() + Math.round((position.x - stage.x()) / scale / step) * step * scale,
          y: stage.y() + Math.round((position.y - stage.y()) / scale / step) * step * scale };
      }}>
      <Rect x={-r.width * ppm / 2} y={-r.height * ppm / 2} width={r.width * ppm} height={r.height * ppm}
        fill={item.kind === 'desks' ? '#dbeafe' : '#dcfce7'} stroke={selected ? '#1d4ed8' : '#475569'} strokeWidth={selected ? 2 : 1} strokeScaleEnabled={false} cornerRadius={3} />
      <Text x={-r.width * ppm / 2 + 4} y={-r.height * ppm / 2 + 4} width={Math.max(1, r.width * ppm - 8)} height={Math.max(1, r.height * ppm - 8)}
        text={`${item.kind === 'desks' ? 'Mesa' : 'Rack'}\n${item.name}`} fontSize={13} fill="#1e293b" align="center" verticalAlign="middle" ellipsis />
    </Group>
    {selected && editable && <Transformer ref={transformer} flipEnabled={false} keepRatio={false} rotateEnabled
      rotationSnaps={snap ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
      boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox} />}
  </>;
}

export function PlanCanvas({ width, height, camera, objects, selected, editable, interactive, pan, grid, snap, select, change, setCamera, layout, tool, vertices, drawPoint, editDrawing }: {
  width: number; height: number; camera: LayoutCamera; objects: CanvasObject[]; selected: string; editable: boolean;
  interactive: boolean; pan: boolean; grid: boolean; snap: boolean; select: (id: string) => void;
  change: (id: string, placement: Rectangle) => void; setCamera: (camera: LayoutCamera) => void;
  layout: PlanLayout; tool: 'select' | 'wall' | 'sector' | 'door' | 'window'; vertices: Position[];
  drawPoint: (point: Position, wallId?: string) => void; editDrawing: (layout: PlanLayout) => void;
}) {
  const stage = useRef<Konva.Stage>(null);
  const quantize = (v: number) => rounded(snap ? Math.round(v * 4) / 4 : v);
  const points = (values: Position[]) => values.flatMap(p => [p.x*ppm,p.y*ppm]);
  const choose = (id: string) => { if (tool === 'select') select(id); };
  function draw(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!interactive || pan) return;
    if (tool === 'select') { if (e.target === stage.current) select(''); return; }
    const pointer = stage.current?.getPointerPosition(); if (!pointer) return;
    const wallId = (e.target as Konva.Node).getAttr('wallId') as string | undefined;
    drawPoint({ x: quantize((pointer.x-camera.x)/camera.zoom/ppm), y: quantize((pointer.y-camera.y)/camera.zoom/ppm) }, wallId);
  }
  function handle(point: Position, update: (value: Position) => void, key: string) {
    return <Circle key={key} x={point.x*ppm} y={point.y*ppm} radius={5/camera.zoom} fill="#ffffff" stroke="#1d4ed8" strokeScaleEnabled={false} draggable={editable && !pan}
      onDragEnd={e => { const p = { x: quantize(e.target.x()/ppm), y: quantize(e.target.y()/ppm) }; e.target.position({ x: point.x*ppm, y: point.y*ppm }); update(p); }} />;
  }
  const spacing = .25 * ppm * Math.pow(2, Math.max(0, Math.ceil(Math.log2(16 / (.25 * ppm * camera.zoom)))));
  const lines = [];
  if (grid) {
    const left = -camera.x / camera.zoom, top = -camera.y / camera.zoom;
    for (let x = Math.floor(left / spacing) * spacing; x < left + width / camera.zoom; x += spacing)
      lines.push(<Line key={`x${x}`} points={[x, top, x, top + height / camera.zoom]} stroke={x === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={1} strokeScaleEnabled={false} />);
    for (let y = Math.floor(top / spacing) * spacing; y < top + height / camera.zoom; y += spacing)
      lines.push(<Line key={`y${y}`} points={[left, y, left + width / camera.zoom, y]} stroke={y === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={1} strokeScaleEnabled={false} />);
  }
  return <Stage ref={stage} width={width} height={height} x={camera.x} y={camera.y} scaleX={camera.zoom} scaleY={camera.zoom} draggable={pan && interactive}
    onClick={draw} onTap={draw}
    onDragEnd={e => { if (e.target === stage.current) setCamera({ ...camera, x: e.target.x(), y: e.target.y() }); }}
    onWheel={e => {
      e.evt.preventDefault();
      if (!interactive) return;
      const pointer = stage.current?.getPointerPosition(); if (!pointer) return;
      const zoom = Math.max(.05, Math.min(8, camera.zoom * (e.evt.deltaY < 0 ? 1.15 : 1 / 1.15)));
      setCamera({ zoom, x: pointer.x - (pointer.x - camera.x) / camera.zoom * zoom, y: pointer.y - (pointer.y - camera.y) / camera.zoom * zoom });
    }}>
    <Layer listening={false}>{lines}</Layer>
    <Layer>
      {layout.sectors.map(s => <Group key={s.id} x={0} y={0} draggable={editable && !pan} onClick={() => choose(s.id)} onTap={() => choose(s.id)} onDragStart={() => choose(s.id)}
        onDragEnd={e => { if (e.target !== e.currentTarget) return; const dx = quantize(e.target.x()/ppm), dy = quantize(e.target.y()/ppm); e.target.position({ x: 0, y: 0 });
          const next = structuredClone(layout); next.sectors.find(v => v.id === s.id)!.polygon = s.polygon.map(p => ({ x: p.x+dx, y: p.y+dy })); editDrawing(next); }}>
        <Line points={points(s.polygon)} closed fill="#f1f5f9" opacity={.7} stroke={selected === s.id ? '#1d4ed8' : '#94a3b8'} strokeWidth={2} strokeScaleEnabled={false} />
        <Text x={Math.min(...s.polygon.map(p => p.x))*ppm+8} y={Math.min(...s.polygon.map(p => p.y))*ppm+8} text={s.name ?? 'Setor'} fontSize={14} fill="#334155" listening={false} />
      </Group>)}
      {layout.geometry.walls.map((w,i) => <Group key={w.id} x={0} y={0} draggable={editable && !pan} onClick={() => choose(w.id)} onTap={() => choose(w.id)} onDragStart={() => choose(w.id)}
        onDragEnd={e => { if (e.target !== e.currentTarget) return; const dx = quantize(e.target.x()/ppm), dy = quantize(e.target.y()/ppm); e.target.position({ x: 0, y: 0 });
          const next = structuredClone(layout), wall = next.geometry.walls.find(v => v.id === w.id)!;
          wall.start = { x: w.start.x+dx, y: w.start.y+dy }; wall.end = { x: w.end.x+dx, y: w.end.y+dy }; editDrawing(next); }}>
        <Line wallId={w.id} points={points([w.start,w.end])} stroke={selected === w.id ? '#1d4ed8' : '#334155'} strokeWidth={w.thickness*ppm} hitStrokeWidth={Math.max(12/camera.zoom,w.thickness*ppm)} />
        <Text x={(w.start.x+w.end.x)/2*ppm} y={(w.start.y+w.end.y)/2*ppm-20} text={`P${i+1}`} fontSize={12} listening={false} />
      </Group>)}
      {layout.geometry.openings.map(o => {
        const wall = layout.geometry.walls.find(w => w.id === o.wallId)!;
        const dx = wall.end.x-wall.start.x, dy = wall.end.y-wall.start.y, length = Math.hypot(dx,dy);
        const start = { x: wall.start.x+dx/length*o.offset, y: wall.start.y+dy/length*o.offset };
        return <Group key={o.id} x={start.x*ppm} y={start.y*ppm} rotation={Math.atan2(dy,dx)*180/Math.PI} onClick={() => choose(o.id)} onTap={() => choose(o.id)}>
          <Rect x={0} y={-wall.thickness*ppm/2} width={o.width*ppm} height={wall.thickness*ppm} fill="#ffffff" stroke={selected === o.id ? '#1d4ed8' : o.kind === 'door' ? '#b45309' : '#0284c7'} strokeScaleEnabled={false} />
          {o.kind === 'door' ? <Line points={[0,0,0,-o.width*ppm,o.width*ppm,0]} stroke="#b45309" strokeWidth={1} dash={[4,3]} strokeScaleEnabled={false} />
            : <Line points={[0,0,o.width*ppm,0]} stroke="#0284c7" strokeWidth={2} strokeScaleEnabled={false} />}
        </Group>;
      })}
    </Layer>
    <Layer>{objects.filter(item => item.placement).map(item => <ObjectShape key={item.id} item={item} selected={selected === item.id}
      editable={editable && !pan} snap={snap} choose={() => choose(item.id)} change={placement => change(item.id, placement)} />)}</Layer>
    <Layer>{editable && !pan && <>
      {layout.sectors.filter(s => s.id === selected).flatMap(s => s.polygon.map((p,i) => handle(p, value => {
        const next = structuredClone(layout); next.sectors.find(v => v.id === s.id)!.polygon[i] = value; editDrawing(next);
      }, `vertex${i}`)))}
      {layout.geometry.walls.filter(w => w.id === selected).flatMap(w => (['start','end'] as const).map(end => handle(w[end], value => {
        const next = structuredClone(layout); next.geometry.walls.find(v => v.id === w.id)![end] = value; editDrawing(next);
      }, end)))}
    </>}</Layer>
    <Layer listening={false}><Line points={points(vertices)} stroke="#1d4ed8" strokeWidth={2} dash={[6,4]} strokeScaleEnabled={false} />{vertices.map((p,i) => <Circle key={i} x={p.x*ppm} y={p.y*ppm} radius={4/camera.zoom} fill="#1d4ed8" />)}</Layer>
  </Stage>;
}
