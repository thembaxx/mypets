import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLocalGlb } from '../lib/validate-local-glb';

function makeGlb(doc: Record<string, unknown>) {
  const json = JSON.stringify(doc);
  const padding = (4 - (json.length % 4)) % 4;
  const body = Buffer.from(json + ' '.repeat(padding), 'utf8');
  const bytes = Buffer.alloc(20 + body.length);
  bytes.write('glTF', 0, 4, 'ascii');
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.byteLength, 8);
  bytes.writeUInt32LE(body.byteLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  body.copy(bytes, 20);
  return Uint8Array.from(bytes).buffer;
}

const valid = { asset: { version: '2.0' }, scenes: [{}], nodes: [], buffers: [{ byteLength: 0 }] };

test('accepts self-contained glTF 2.0 payload', () => {
  assert.doesNotThrow(() => validateLocalGlb(makeGlb(valid)));
});
test('rejects malicious external texture references', () => {
  assert.throws(
    () =>
      validateLocalGlb(
        makeGlb({ ...valid, images: [{ uri: 'https://not-local.invalid/tracker.png' }] }),
      ),
    /External model textures/,
  );
});
test('rejects external buffers, unsupported extensions and invalid header', () => {
  assert.throws(
    () => validateLocalGlb(makeGlb({ ...valid, buffers: [{ uri: '../external.bin' }] })),
    /External model textures/,
  );
  assert.throws(
    () => validateLocalGlb(makeGlb({ ...valid, extensionsRequired: ['VENDOR_untrusted'] })),
    /unsupported GLB extension/,
  );
  assert.throws(() => validateLocalGlb(new ArrayBuffer(20)), /glTF 2.0 binary/);
});
test('accepts detailed meshes without imposing visual fidelity budgets', () => {
  assert.doesNotThrow(() =>
    validateLocalGlb(
      makeGlb({
        ...valid,
        accessors: [{ count: 2_000_001 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      }),
    ),
  );
});
test('rejects an invalid accessor even when geometry detail is unrestricted', () => {
  assert.throws(
    () =>
      validateLocalGlb(
        makeGlb({
          ...valid,
          accessors: [],
          meshes: [{ primitives: [{ attributes: { POSITION: 3 } }] }],
        }),
      ),
    /invalid mesh POSITION/,
  );
});
test('rejects unaligned chunks and misleading file lengths', () => {
  const bytes = new Uint8Array(makeGlb(valid));
  new DataView(bytes.buffer).setUint32(12, 3, true);
  assert.throws(() => validateLocalGlb(bytes.buffer), /Truncated or unaligned/);
});
