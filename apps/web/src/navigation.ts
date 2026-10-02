import type { NavigationTarget, SearchResult } from '@topologia-new/domain';

/** Permite ao editor proteger o trabalho antes de trocar de contexto ou sair. */
export function confirmNavigation(destination?: string) {
  return window.dispatchEvent(new CustomEvent('topologia:before-navigate', { cancelable: true, detail: { destination } }));
}

export function pushNavigation(destination: string) {
  if (!confirmNavigation(destination)) return false;
  if (destination !== `${location.pathname}${location.search}`) history.pushState(null, '', destination);
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}

export function navigatePark(changes: Record<string, string>) {
  const query = new URLSearchParams(location.search);
  if (['empresa', 'unidade', 'andar', 'planta', 'datacenter'].some(key => key in changes)) {
    for (const key of ['mesa', 'ponto', 'rack', 'equipamento', 'porta', 'foco']) query.delete(key);
  }
  if ('mesa' in changes) { query.delete('ponto'); query.delete('foco'); }
  if ('rack' in changes) { query.delete('equipamento'); query.delete('porta'); query.delete('foco'); }
  if ('equipamento' in changes) query.delete('porta');
  for (const [key, value] of Object.entries(changes)) { if (value) query.set(key, value); else query.delete(key); }
  return pushNavigation(`/parque?${query}`);
}

export function filterConflict(query: URLSearchParams, target: NavigationTarget) {
  return ([['fEmpresa', target.companyId], ['fUnidade', target.unitId], ['fAndar', target.floorId], ['fSetor', target.sectorId]] as const)
    .some(([key, value]) => query.has(key) && query.get(key)?.toLowerCase() !== value?.toLowerCase());
}

/** A URL contém a cadeia completa validada pela API; foco é uma câmera local. */
export function targetURL(result: SearchResult, view: 'list' | 'plan', current = '') {
  const query = new URLSearchParams(current), t = result.target;
  const conflict = filterConflict(query, t);
  for (const key of ['empresa', 'unidade', 'andar', 'planta', 'datacenter', 'mesa', 'ponto', 'rack', 'equipamento', 'porta', 'foco', 'avisoBusca']) query.delete(key);
  if (conflict) {
    for (const key of ['fEmpresa', 'fUnidade', 'fAndar', 'fSetor', 'busca', 'tipo', 'pagina']) query.delete(key);
    query.set('avisoBusca', 'ajustado');
  }
  query.set('empresa', t.companyId); query.set('unidade', t.unitId);
  if (t.deskId || result.kind === 'plan' || (view === 'plan' && t.planId)) {
    if (t.floorId) query.set('andar', t.floorId);
    if (t.planId) query.set('planta', t.planId);
    if (t.deskId) query.set('mesa', t.deskId);
    if (t.pointId) query.set('ponto', t.pointId);
    if (view === 'plan' && (t.deskId || t.rackId)) query.set('foco', t.deskId ?? t.rackId!);
  } else {
    if (t.datacenterId) query.set('datacenter', t.datacenterId);
    if (t.rackId) query.set('rack', t.rackId);
    if (t.equipmentId) query.set('equipamento', t.equipmentId);
    if (t.portId) query.set('porta', t.portId);
  }
  return `/parque?${query}`;
}
