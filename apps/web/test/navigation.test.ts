import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SearchResult } from '@topologia-new/domain';
import { targetURL } from '../src/navigation.js';

const result: SearchResult = { kind: 'port', id: 'port', name: 'Porta', context: 'A / DC 02', positioned: true,
  target: { companyId: 'company', unitId: 'unit', floorId: 'rack-floor', planId: 'rack-plan', sectorId: null,
    deskId: null, pointId: null, datacenterId: 'dc2', rackId: 'rack2', equipmentId: 'panel', portId: 'port' } };
const query = (value: string) => new URL(value, 'http://localhost').searchParams;
test('destino de porta abre datacenter correto, limpa origem e preserva filtros compatíveis', () => {
  const value = query(targetURL(result, 'list', '?mesa=old&ponto=old&andar=old&planta=old&fUnidade=unit&busca=Porta'));
  assert.equal(value.get('datacenter'), 'dc2'); assert.equal(value.get('porta'), 'port'); assert.equal(value.get('equipamento'), 'panel');
  assert.equal(value.get('andar'), null); assert.equal(value.get('mesa'), null); assert.equal(value.get('fUnidade'), 'unit'); assert.equal(value.get('busca'), 'Porta');
});
test('atravessar andar/setor resolve conflito explicitamente, foco gráfico aponta para rack canônico', () => {
  const value = query(targetURL(result, 'plan', '?fAndar=mesa-floor&fSetor=sector&busca=Ponto&tipo=point&pagina=50'));
  assert.equal(value.get('andar'), 'rack-floor'); assert.equal(value.get('planta'), 'rack-plan'); assert.equal(value.get('foco'), 'rack2');
  assert.equal(value.get('datacenter'), null); assert.equal(value.get('rack'), null); assert.equal(value.get('avisoBusca'), 'ajustado');
  for (const key of ['fAndar', 'fSetor', 'busca', 'tipo', 'pagina']) assert.equal(value.get(key), null);
});
test('consulta inversa seleciona mesa e ponto da planta original e limpa destino antigo', () => {
  const origin = { ...result, kind: 'point' as const, target: { ...result.target, floorId: 'mesa-floor', planId: 'mesa-plan', deskId: 'desk', pointId: 'point', datacenterId: null, rackId: null, equipmentId: null, portId: null } };
  const value = query(targetURL(origin, 'list', '?datacenter=dc2&rack=rack2&equipamento=panel&porta=port'));
  assert.equal(value.get('planta'), 'mesa-plan'); assert.equal(value.get('ponto'), 'point'); assert.equal(value.get('mesa'), 'desk');
  for (const key of ['datacenter', 'rack', 'equipamento', 'porta']) assert.equal(value.get(key), null);
});
test('rack sem planta mantém lista acessível e sem posição mantém referência espacial', () => {
  const orphan = { ...result, positioned: false, target: { ...result.target, planId: null, floorId: null } };
  assert.equal(query(targetURL(orphan, 'list')).get('rack'), 'rack2');
  assert.equal(query(targetURL({ ...result, positioned: false }, 'plan')).get('foco'), 'rack2');
});
