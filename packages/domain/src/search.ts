/** Referências canônicas, derivadas por JOIN; nomes nunca resolvem destinos. */
export const searchKinds = ['plan', 'desk', 'point', 'datacenter', 'rack', 'patch_panel', 'port'] as const;
export type SearchKind = typeof searchKinds[number];
export interface NavigationTarget {
  companyId: string; unitId: string;
  floorId: string | null; planId: string | null; sectorId: string | null;
  deskId: string | null; pointId: string | null; datacenterId: string | null;
  rackId: string | null; equipmentId: string | null; portId: string | null;
}
export interface SearchResult {
  kind: SearchKind; id: string; name: string; context: string;
  positioned: boolean; target: NavigationTarget;
}
export interface SearchFacet { id: string; name: string; context: string; companyId: string; unitId: string; floorId?: string; planId?: string }
export interface SearchResponse {
  results: SearchResult[]; total: number; offset: number; limit: number;
  facets: { units: SearchFacet[]; floors: SearchFacet[]; sectors: SearchFacet[] };
}
