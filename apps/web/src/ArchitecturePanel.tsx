import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { isPlanLayout, type LayoutSector, type Opening, type PlanLayout, type Wall } from '@topologia-new/domain';
import { removeDrawingItem } from './layoutEditor';

export function ArchitecturePanel({ layout, selected, select, editable, writable, change }: {
  layout: PlanLayout; selected: string; select: (id: string) => void; editable: boolean; writable: boolean; change: (layout: PlanLayout) => void;
}) {
  const wall = layout.geometry.walls.find(w => w.id === selected), opening = layout.geometry.openings.find(o => o.id === selected), sector = layout.sectors.find(s => s.id === selected);
  const [pending, setPending] = useState<Opening | null>(null);
  const source = wall ?? opening ?? sector ?? (pending?.id === selected ? pending : undefined);
  const [fields, setFields] = useState<Wall | Opening | LayoutSector | null>(source ?? null);
  useEffect(() => setFields(source ? structuredClone(source) : null), [source]);
  function create(kind: 'wall' | 'door' | 'window' | 'sector') {
    const next = structuredClone(layout), id = crypto.randomUUID();
    const center = { x: -layout.camera.x / layout.camera.zoom / 80 + 1, y: -layout.camera.y / layout.camera.zoom / 80 + 1 };
    if (kind === 'wall') next.geometry.walls.push({ id, start: center, end: { x: center.x + 4, y: center.y }, thickness: .15 });
    else if (kind === 'sector') {
      let n = 1; while (next.sectors.some(s => s.name === `Setor ${n}`)) n++;
      next.sectors.push({ id, name: `Setor ${n}`, polygon: [center, { x: center.x+3, y: center.y }, { x: center.x+3, y: center.y+3 }, { x: center.x, y: center.y+3 }] });
    } else {
      const parent = wall ?? layout.geometry.walls[0]; if (!parent) return;
      // Configurar antes de inserir: paredes curtas ou ocupadas também podem
      // receber uma abertura por campos com largura/offset definidos pelo usuário.
      setPending({ id, wallId: parent.id, kind, offset: 0, width: kind === 'door' ? .9 : 1.2 }); select(id); return;
    }
    change(next); select(id);
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!fields) return;
    const next = structuredClone(layout);
    if ('start' in fields) next.geometry.walls = next.geometry.walls.map(w => w.id === selected ? fields : w);
    else if ('wallId' in fields) {
      if (pending?.id === fields.id) next.geometry.openings.push(fields);
      else next.geometry.openings = next.geometry.openings.map(o => o.id === selected ? fields : o);
    }
    else next.sectors = next.sectors.map(s => s.id === selected ? fields : s);
    change(next);
    if (isPlanLayout(next)) setPending(null);
  }
  function number(label: string, value: number, update: (value: number) => void, min?: number) {
    return <label>{label}<input type="number" step="any" required disabled={!editable} min={min} value={Number.isFinite(value) ? value : ''} onChange={e => update(e.target.valueAsNumber)} /></label>;
  }
  return <div className="plan-details architecture-panel">
    <div><h4>Paredes, aberturas e setores</h4>
      {writable && <><p className="intro">Crie por campos ou pelas ferramentas de desenho acima.</p><div className="plan-toolbar">
        <button className="secondary" disabled={!editable} onClick={() => create('wall')}>Nova parede por campos</button>
        <button className="secondary" disabled={!editable || !layout.geometry.walls.length} onClick={() => create('door')}>Nova porta por campos</button>
        <button className="secondary" disabled={!editable || !layout.geometry.walls.length} onClick={() => create('window')}>Nova janela por campos</button>
        <button className="secondary" disabled={!editable} onClick={() => create('sector')}>Novo setor por campos</button>
      </div></>}
      <ul className="plan-object-list">{layout.geometry.walls.map((w,i) => <li key={w.id}><button className="secondary" aria-pressed={selected === w.id} onClick={() => select(w.id)}>Parede {i+1}</button></li>)}
        {layout.geometry.openings.map((o,i) => <li key={o.id}><button className="secondary" aria-pressed={selected === o.id} onClick={() => select(o.id)}>{o.kind === 'door' ? 'Porta' : 'Janela'} {i+1} · Parede {layout.geometry.walls.findIndex(w => w.id === o.wallId)+1}</button></li>)}
        {layout.sectors.map(s => <li key={s.id}><button className="secondary" aria-pressed={selected === s.id} onClick={() => select(s.id)}>Setor: {s.name ?? s.id} · {layout.desks.filter(d => d.sectorId === s.id).length} mesa(s)</button></li>)}
      </ul>
    </div>
    <div>{fields ? <form className="plan-properties" onSubmit={submit}>
      <h4>Propriedades de {'start' in fields ? 'parede' : 'wallId' in fields ? fields.kind === 'door' ? 'porta' : 'janela' : 'setor'}</h4>
      <p className="intro">ID: {fields.id}</p>
      {'start' in fields ? <><div className="placement-fields">{(['start','end'] as const).flatMap(end => (['x','y'] as const).map(axis => <div key={`${end}${axis}`}>{number(`${end === 'start' ? 'Início' : 'Fim'} ${axis.toUpperCase()} (m)`, fields[end][axis], v => setFields({ ...fields, [end]: { ...fields[end], [axis]: v } }))}</div>))}
        {number('Espessura (m)', fields.thickness, v => setFields({ ...fields, thickness: v }), .01)}</div>
        <p className="intro">Mover a parede mantém offsets das aberturas. Encurtar só é permitido se todas couberem; ajuste ou remova as aberturas primeiro.</p></>
      : 'wallId' in fields ? <><label>Parede da abertura<select disabled={!editable} value={fields.wallId} onChange={e => setFields({ ...fields, wallId: e.target.value })}>{layout.geometry.walls.map((w,i) => <option key={w.id} value={w.id}>Parede {i+1}</option>)}</select></label>
        <label>Tipo de abertura<select disabled={!editable} value={fields.kind} onChange={e => setFields({ ...fields, kind: e.target.value as Opening['kind'] })}><option value="door">Porta</option><option value="window">Janela</option></select></label>
        <div className="placement-fields">{number('Distância do início (m)', fields.offset, v => setFields({ ...fields, offset: v }), 0)}{number('Largura da abertura (m)', fields.width, v => setFields({ ...fields, width: v }), .01)}</div></>
      : <><label>Nome do setor<input required maxLength={200} disabled={!editable} value={fields.name ?? ''} onChange={e => setFields({ ...fields, name: e.target.value })} /></label>
        <p className="intro">Vértices em ordem, sem repetir o primeiro. A associação das mesas é explícita e permanece ao mover o polígono.</p>
        {fields.polygon.map((p,i) => <div key={i} className="placement-fields">{(['x','y'] as const).map(axis => <div key={axis}>{number(`Vértice ${i+1} ${axis.toUpperCase()} (m)`, p[axis], v => setFields({ ...fields, polygon: fields.polygon.map((point,j) => j === i ? { ...point, [axis]: v } : point) }))}</div>)}
          {writable && <button type="button" className="secondary" disabled={!editable || fields.polygon.length <= 3} onClick={() => setFields({ ...fields, polygon: fields.polygon.filter((_,j) => j !== i) })}>Remover vértice {i+1}</button>}</div>)}
        {writable && <button type="button" className="secondary" disabled={!editable} onClick={() => setFields({ ...fields, polygon: [...fields.polygon, { x: fields.polygon.at(-1)!.x+1, y: fields.polygon.at(-1)!.y+1 }] })}>Adicionar vértice</button>}</>}
      {writable && <><button disabled={!editable} type="submit">Aplicar geometria</button><button disabled={!editable} type="button" className="secondary" onClick={() => {
        const count = wall ? layout.geometry.openings.filter(o => o.wallId === wall.id).length : sector ? layout.desks.filter(d => d.sectorId === sector.id).length : 0;
        const description = wall ? `Remover parede e suas ${count} abertura(s)?` : sector ? `Remover setor e desvincular ${count} mesa(s), preservando mesas e pontos?` : 'Remover abertura?';
        if (window.confirm(description)) { change(removeDrawingItem(layout, selected)); select(''); }
      }}>Remover {wall ? 'parede' : sector ? 'setor' : 'abertura'}</button></>}
    </form> : <p className="empty-state">Selecione uma parede, abertura ou setor para {writable ? 'editar' : 'consultar'} suas propriedades.</p>}</div>
  </div>;
}
