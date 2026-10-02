import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanGeometry, type PlanLayout } from '@topologia-new/domain';
import { applyDrawing, drawing, removeDrawingItem, applyPlacements, fitCamera, placements, reconcile } from '../src/layoutEditor.js';

const rectangle = { x: 1, y: 2, width: 2, height: 1, rotation: 0 };
const fixture = (): PlanLayout => ({ version: 1, unit: 'm', geometry: emptyPlanGeometry(), camera: { x: 10, y: 20, zoom: 1 },
  desks: [{ id: 'mesa-preservada', placement: { ...rectangle } }, { id: 'mesa-removida', placement: { ...rectangle } }],
  racks: [{ id: 'rack-preservado', placement: null }], sectors: [{ id: 'setor', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }],
});

test('remoção de parede leva aberturas e histórico restaura IDs; setor desvincula sem apagar mesas', () => {
  const layout = fixture();
  layout.geometry.walls = [{id:'w',start:{x:0,y:0},end:{x:4,y:0},thickness:.15}];
  layout.geometry.openings = [{id:'o',wallId:'w',kind:'door',offset:1,width:.9}];
  layout.desks[0]!.sectorId = 'setor';
  layout.desks[1]!.sectorId = null;
  const old = drawing(layout), withoutWall = removeDrawingItem(layout,'w');
  assert.equal(withoutWall.geometry.openings.length,0);
  const withoutSector = removeDrawingItem(withoutWall,'setor');
  assert.equal(withoutSector.desks.length,2); assert.equal(withoutSector.desks[0]!.sectorId,null);
  withoutSector.camera.zoom = 2;
  const restored = applyDrawing(withoutSector,old);
  assert.deepEqual(drawing(restored),old); assert.equal(restored.camera.zoom,2);
});

test('histórico de posições não recria membros nem reverte câmera, paredes ou setores', () => {
  const old = fixture(), latest = fixture();
  latest.desks = [{ id: 'mesa-preservada', placement: { ...rectangle, x: 8 } }, { id: 'mesa-nova', placement: { ...rectangle } }];
  latest.camera.zoom = 3;
  latest.geometry.walls.push({ id: 'parede', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, thickness: .15 });
  const result = applyPlacements(latest, placements(old));
  assert.deepEqual(result.desks.map(item => item.id), ['mesa-preservada', 'mesa-nova']);
  assert.equal(result.desks[0]!.placement.x, 1);
  assert.deepEqual(result.camera, latest.camera);
  assert.deepEqual(result.geometry, latest.geometry);
  assert.deepEqual(result.sectors, latest.sectors);
});

test('reconciliação só reaplica edições locais para IDs atuais, preservando alterações remotas restantes', () => {
  const baseline = fixture(), local = fixture(), remote = fixture();
  local.desks[0]!.placement.rotation = 90;
  local.desks[1]!.placement.x = 15;
  remote.desks.splice(1, 1);
  remote.desks.push({ id: 'mesa-nova', placement: { ...rectangle, x: 30 } });
  remote.racks[0]!.placement = { ...rectangle, y: 12 };
  remote.camera.zoom = 2;
  const result = reconcile(remote, baseline, local);
  assert.equal(result.desks[0]!.placement.rotation, 90);
  assert.equal(result.desks[1]!.placement.x, 30);
  assert.deepEqual(result.racks, remote.racks);
  assert.deepEqual(result.camera, remote.camera);
  assert.equal(result.desks.some(item => item.id === 'mesa-removida'), false);
  assert.equal(local.desks.length, 2);
});

test('enquadramento considera rotação e coordenadas negativas, mantendo todos os cantos visíveis', () => {
  const r = { x: -10, y: 14, width: 8, height: 2, rotation: 45 };
  const camera = fitCamera([r], 1000, 480), angle = Math.PI / 4;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = camera.x + (r.x + sx * r.width / 2 * Math.cos(angle) - sy * r.height / 2 * Math.sin(angle)) * 80 * camera.zoom;
    const y = camera.y + (r.y + sx * r.width / 2 * Math.sin(angle) + sy * r.height / 2 * Math.cos(angle)) * 80 * camera.zoom;
    assert.ok(x >= 49 && x <= 951 && y >= 49 && y <= 431);
  }
});
