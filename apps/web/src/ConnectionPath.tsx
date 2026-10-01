import type { ConnectionDetail } from '@topologia-new/domain';

export function ConnectionPath({ connection }: { connection: ConnectionDetail | null }) {
  if (!connection) return null;
  const { origin, destination } = connection.path;
  return <p className="intro hint" aria-label="Caminho da conexão">
    {origin.desk.name} → {origin.point.name} → {destination.datacenter.name} → {destination.rack.name} → {destination.patchPanel.name} → {destination.port.name}
    <br />Origem: {origin.unit.name} / {origin.floor.name} / {origin.plan.name}
    {destination.floor && <> · Rack: {destination.unit.name} / {destination.floor.name} / {destination.plan!.name}</>}
  </p>;
}
