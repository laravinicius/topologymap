import type { Connection } from './entities.js';

export interface PathEntity { id: string; name: string }
/** Caminho derivado dos cadastros atuais; nunca persistido como uma segunda relação. */
export interface ConnectionPath {
  company: PathEntity;
  origin: { unit: PathEntity; floor: PathEntity; plan: PathEntity; sector: PathEntity | null; desk: PathEntity; point: PathEntity };
  destination: { unit: PathEntity; datacenter: PathEntity; rack: PathEntity; plan: PathEntity | null; floor: PathEntity | null; patchPanel: PathEntity; port: PathEntity };
}
export interface ConnectionDetail extends Connection { path: ConnectionPath }
export interface ConnectionInput { pointId: string; portId: string }
/** ID da conexão vem na URL. Revisão e extremidades impedem gravar sobre uma leitura antiga. */
export interface ExpectedConnection extends ConnectionInput { revision: number }
export interface ConnectionTransferInput extends ConnectionInput { expected: ExpectedConnection }
export interface ConnectionDeleteInput { expected: ExpectedConnection }
export interface PointConnection { pointId: string; connection: ConnectionDetail | null }
export interface PortConnection { portId: string; connection: ConnectionDetail | null }
