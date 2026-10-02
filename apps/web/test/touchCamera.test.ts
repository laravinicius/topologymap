import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchCamera } from '../src/touchCamera.js';

test('pan com um dedo preserva escala e desloca somente a câmera', () => {
  const camera = { x: -20, y: 40, zoom: 2 };
  assert.deepEqual(touchCamera(camera, [{ x: 30, y: 50 }], [{ x: 70, y: 20 }]), { x: 20, y: 10, zoom: 2 });
  assert.deepEqual(camera, { x: -20, y: 40, zoom: 2 });
});
test('pinça mantém o ponto do mundo sob o centro dos dedos enquanto eles se deslocam', () => {
  const before = { x: -20, y: 40, zoom: 2 };
  const after = touchCamera(before, [{ x: 50, y: 100 }, { x: 150, y: 100 }], [{ x: 20, y: 120 }, { x: 220, y: 120 }]);
  assert.equal(after.zoom, 4);
  assert.equal((120-after.x)/after.zoom, (100-before.x)/before.zoom);
  assert.equal((120-after.y)/after.zoom, (100-before.y)/before.zoom);
});
test('limites, dedos coincidentes e transição de quantidade não introduzem saltos ou NaN', () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  assert.deepEqual(touchCamera(camera, [{ x: 0, y: 0 }], [{ x: 10, y: 10 }, { x: 20, y: 20 }]), camera);
  assert.deepEqual(touchCamera(camera, [], []), camera);
  const previous = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  assert.equal(touchCamera(camera, previous, [{ x: 0, y: 0 }, { x: 100, y: 0 }]).zoom, 8);
  assert.equal(touchCamera(camera, previous, [{ x: 0, y: 0 }, { x: 0, y: 0 }]).zoom, .05);
  assert.ok(Number.isFinite(touchCamera(camera, [previous[0]!, previous[0]!], previous).x));
});
