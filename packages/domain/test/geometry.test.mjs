import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanGeometry, isRectangle, isPolygon, isPlanGeometry } from '../dist/index.js';

test('geometria vazia e medidas em metros independentes de câmera/renderizador', () => {
  assert.equal(isPlanGeometry(emptyPlanGeometry()), true);
  assert.equal(isRectangle({ x: -5, y: 8, width: 1.2, height: 0.6, rotation: 90 }), true);
  for (const patch of [{ width: 0 }, { height: -1 }, { rotation: 360 }, { x: Infinity }, { y: NaN }]) {
    assert.equal(isRectangle({ x: 0, y: 0, width: 1, height: 1, rotation: 0, ...patch }), false);
  }
});
test('setor exige polígono com vértices distintos e área não nula', () => {
  assert.equal(isPolygon([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]), true);
  assert.equal(isPolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]), false);
  assert.equal(isPolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]), false);
});
test('aberturas mantêm identidade e pertencem a uma parede, em metros e dentro dela', () => {
  const geometry = { ...emptyPlanGeometry(),
    walls: [{ id: 'wall-1', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, thickness: 0.15 }],
    openings: [{ id: 'door-1', kind: 'door', wallId: 'wall-1', offset: 1, width: 0.9 }] };
  assert.equal(isPlanGeometry(geometry), true);
  assert.equal(isPlanGeometry({ ...geometry, walls: [...geometry.walls, ...geometry.walls] }), false);
  assert.equal(isPlanGeometry({ ...geometry, openings: [...geometry.openings, ...geometry.openings] }), false);
  for (const patch of [{ wallId: 'absent' }, { offset: -1 }, { width: 5 }, { kind: 'other' }]) {
    assert.equal(isPlanGeometry({ ...geometry, openings: [{ ...geometry.openings[0], ...patch }] }), false);
  }
  assert.equal(isPlanGeometry({ ...geometry, version: 2 }), false);
  assert.equal(isPlanGeometry({ ...geometry, unit: 'px' }), false);
});
test('fundo mantém metadados do arquivo separados da transformação em metros', () => {
  const background = { originalFileId: 'original', renderedFileId: 'image', page: 2,
    sourceWidthPx: 1200, sourceHeightPx: 800, placement: { x: 10, y: 5, width: 20, height: 10, rotation: 0 } };
  assert.equal(isPlanGeometry({ ...emptyPlanGeometry(), background }), true);
  for (const patch of [{ page: 0 }, { sourceWidthPx: 1.5 }, { originalFileId: '' }, { placement: {} }]) {
    assert.equal(isPlanGeometry({ ...emptyPlanGeometry(), background: { ...background, ...patch } }), false);
  }
});

test('setores rejeitam cruzamentos com área não nula e arestas que se sobrepõem', () => {
  assert.equal(isPolygon([{x:0,y:0},{x:4,y:3},{x:0,y:3},{x:3,y:0}]), false);
  assert.equal(isPolygon([{x:0,y:0},{x:4,y:0},{x:2,y:0},{x:2,y:3},{x:0,y:3}]), false);
  assert.equal(isPolygon([{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:2,y:2},{x:0,y:4}]), true);
});

test('aberturas não se sobrepõem e podem encostar nas extremidades', () => {
  const wall = { id:'w',start:{x:0,y:0},end:{x:4,y:0},thickness:.15 };
  const a = { id:'a',kind:'door',wallId:'w',offset:0,width:1 };
  const b = { id:'b',kind:'window',wallId:'w',offset:1,width:3 };
  assert.equal(isPlanGeometry({ ...emptyPlanGeometry(), walls:[wall], openings:[a,b] }), true);
  assert.equal(isPlanGeometry({ ...emptyPlanGeometry(), walls:[wall], openings:[a,{...b,offset:.5}] }), false);
});
