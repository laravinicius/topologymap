import type { EquipmentDetail, RackDetail } from '@topologia-new/domain';

export function RackFront({ rack, writable, selectedPort, onSelectPort, onMove, onEdit }: {
  rack: RackDetail; writable: boolean; selectedPort: string;
  onSelectPort: (equipment: EquipmentDetail, portId: string) => void;
  onMove: (equipmentId: string, startU: number) => void;
  onEdit: (equipment: EquipmentDetail) => void;
}) {
  return <section className="rack-front-section" aria-label={`Vista frontal do rack ${rack.name}`}>
    <div className="panel-header"><div><h4>Vista frontal · {rack.capacityU} U</h4><p className="intro">U mais altas no topo; cada faixa representa uma unidade.</p></div></div>
    <button className="secondary" onClick={() => document.getElementById('rack-equipment-list')?.scrollIntoView({ block: 'start' })}>Consultar equipamentos e portas pela lista</button>
    <div className="rack-front-scroll">
      <div className="rack-front" style={{ '--rack-units': rack.capacityU } as React.CSSProperties}>
        <div className="rack-u-labels" aria-hidden="true">{Array.from({ length: rack.capacityU }, (_, index) => <span key={index}>{rack.capacityU - index}</span>)}</div>
        <div className="rack-bay" role="group" aria-label="Posições do rack">
          {rack.equipment.map(item => {
            const row = rack.capacityU - item.startU - item.heightU + 2;
            const detail = item;
            return <div key={item.id} className={`rack-unit-equipment ${item.kind === 'patch_panel' ? 'patch-panel' : 'generic-equipment'}`}
              style={{ gridRow: `${row} / span ${item.heightU}` }} draggable={writable} onDragStart={event => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={event => { event.currentTarget.removeAttribute('data-dragging'); }} data-equipment-id={item.id}>
              <div className="rack-equipment-heading" title={`${item.name} · ${item.equipmentType} · ${item.heightU} U`}><strong>{item.name}</strong>
                <span>{item.equipmentType} · {item.heightU} U</span>
              </div>
              <div className="rack-equipment-controls">
                {writable && <button type="button" className="rack-edit-position secondary" aria-label={`Editar posição de ${item.name}`} onClick={() => onEdit(detail)}>Editar posição</button>}
                {writable && <span className="rack-position-controls" aria-label={`Posição de ${item.name}`}>
                  <button type="button" className="secondary" aria-label={`Mover ${item.name} uma U para cima`} disabled={item.startU + item.heightU > rack.capacityU} onClick={() => onMove(item.id, item.startU + 1)}>↑</button>
                  <button type="button" className="secondary" aria-label={`Mover ${item.name} uma U para baixo`} disabled={item.startU <= 1} onClick={() => onMove(item.id, item.startU - 1)}>↓</button>
                </span>}
              </div>
              {detail.kind === 'patch_panel' && <div className="rack-visual-ports" aria-label={`Portas de ${detail.name}`}>
                {detail.ports.map(port => <button type="button" key={port.id} className={`rack-visual-port ${port.connectionId ? 'occupied' : 'free'} ${selectedPort === port.id ? 'selected' : ''}`}
                  aria-label={`${port.name}, ${port.connectionId ? `ocupada por ${port.connection?.path.origin.desk.name}, ${port.connection?.path.origin.point.name}` : 'livre'}`}
                  aria-pressed={selectedPort === port.id} title={`${port.name}: ${port.connectionId ? `Ocupada · ${port.connection?.path.origin.desk.name} / ${port.connection?.path.origin.point.name}` : 'Livre'}`}
                  onClick={() => onSelectPort(detail, port.id)}>{port.ordinal}</button>)}
              </div>}
            </div>;
          })}
          {Array.from({ length: rack.capacityU }, (_, index) => {
            const u = rack.capacityU - index;
            return <div key={u} className="rack-drop-slot" style={{ gridRow: index + 1 }} aria-label={`U ${u} do rack`} onDragOver={event => { if (writable) event.preventDefault(); }}
              onDrop={event => {
                event.preventDefault(); const id = event.dataTransfer.getData('text/plain');
                const rowEquipment = rack.equipment.find(candidate => candidate.id === id);
                if (writable && rowEquipment) onMove(rowEquipment.id, u - rowEquipment.heightU + 1);
              }} />;
          })}
          {!rack.equipment.length && <p className="rack-empty">Rack vazio</p>}
        </div>
      </div>
    </div>
    <p className="intro hint">{writable ? 'Arraste um equipamento até a U de destino. A gravação preserva as conexões e a API rejeita sobreposição ou posições fora da capacidade.' : 'Deslize dentro da vista frontal para consultar o rack. Abra um equipamento na lista para ver nomes completos, portas e conexões.'}</p>
  </section>;
}
