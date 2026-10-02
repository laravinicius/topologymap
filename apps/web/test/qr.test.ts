import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { publicDeskUrl, publicOrigin } from '@topologia-new/domain';
import { deskQr } from '../src/qr.js';

test('QR PNG gerado localmente decodifica a URL exata, incluindo porta/origem/token', async () => {
  const token = 'ab'.repeat(32);
  for (const origin of ['http://localhost:5173', 'https://consulta.example.test', 'http://192.0.2.10:8080']) {
    const qr = await deskQr(origin, token);
    const { data, info } = await sharp(Buffer.from(qr.image.split(',')[1]!, 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    assert.equal(decoded?.data, `${origin}/mesa/${token}`); assert.equal(qr.url, decoded?.data);
  }
});
test('origem/token recusam caminho, credenciais, query, fragmento, protocolos externos e HTTP em produção', () => {
  for (const origin of ['https://host/path', 'https://host/', 'https://user:pass@host', 'https://host?query', 'https://host#fragment', 'javascript:alert(1)', 'file:///tmp/test'])
    assert.throws(() => publicOrigin(origin));
  assert.throws(() => publicOrigin('http://host', true));
  assert.equal(publicOrigin('https://host', true), 'https://host');
  assert.throws(() => publicDeskUrl('https://host', 'uuid'));
});
