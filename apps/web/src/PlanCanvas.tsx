import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { Stage, Layer, Group, Rect, Text, Line, Transformer } from 'react-konva';
import type { LayoutCamera, Rectangle } from '@topologia-new/domain';
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

export function PlanCanvas({ width, height, camera, objects, selected, editable, interactive, pan, grid, snap, select, change, setCamera }: {
  width: number; height: number; camera: LayoutCamera; objects: CanvasObject[]; selected: string; editable: boolean;
  interactive: boolean; pan: boolean; grid: boolean; snap: boolean; select: (id: string) => void;
  change: (id: string, placement: Rectangle) => void; setCamera: (camera: LayoutCamera) => void;
}) {
  const stage = useRef<Konva.Stage>(null);
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
    onMouseDown={e => { if (e.target === e.target.getStage()) select(''); }}
    onTap={e => { if (e.target === e.target.getStage()) select(''); }}
    onDragEnd={e => { if (e.target === stage.current) setCamera({ ...camera, x: e.target.x(), y: e.target.y() }); }}
    onWheel={e => {
      e.evt.preventDefault();
      if (!interactive) return;
      const pointer = stage.current?.getPointerPosition(); if (!pointer) return;
      const zoom = Math.max(.05, Math.min(8, camera.zoom * (e.evt.deltaY < 0 ? 1.15 : 1 / 1.15)));
      setCamera({ zoom, x: pointer.x - (pointer.x - camera.x) / camera.zoom * zoom, y: pointer.y - (pointer.y - camera.y) / camera.zoom * zoom });
    }}>
    <Layer listening={false}>{lines}</Layer>
    <Layer>{objects.filter(item => item.placement).map(item => <ObjectShape key={item.id} item={item} selected={selected === item.id}
      editable={editable && !pan} snap={snap} choose={() => select(item.id)} change={placement => change(item.id, placement)} />)}</Layer>
  </Stage>;
}
