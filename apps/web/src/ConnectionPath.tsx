import type { ConnectionDetail } from '@topologia-new/domain';
import { ObjectLink } from './ObjectLink';

export function ConnectionPath({ connection }: { connection: ConnectionDetail | null }) {
  if (!connection) return null;
  const { origin, destination } = connection.path;
  return <div className="intro connection-path" aria-label="Caminho da conexão">
    {origin.desk.name} → {origin.point.name} → {destination.datacenter.name} → {destination.rack.name} → {destination.patchPanel.name} → {destination.port.name}
    <br />Origem: {origin.unit.name} / {origin.floor.name} / {origin.plan.name}
    {destination.floor && <> · Rack: {destination.unit.name} / {destination.floor.name} / {destination.plan!.name}</>}
    <div className="park-actions">
      <ObjectLink companyId={connection.companyId} kind="point" id={origin.point.id}>Consultar origem: {origin.point.name}</ObjectLink>
      <ObjectLink companyId={connection.companyId} kind="point" id={origin.point.id} view="plan">Localizar mesa na planta</ObjectLink>
      <ObjectLink companyId={connection.companyId} kind="datacenter" id={destination.datacenter.id}>Abrir {destination.datacenter.name}</ObjectLink>
      <ObjectLink companyId={connection.companyId} kind="port" id={destination.port.id}>Consultar destino: {destination.port.name}</ObjectLink>
      {destination.plan && <ObjectLink companyId={connection.companyId} kind="rack" id={destination.rack.id} view="plan">Localizar rack na planta</ObjectLink>}
    </div>
  </div>;
}
