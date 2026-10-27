import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlb } from './validate-3d-assets.mjs';

function glb(gltf) {
  const payload = Buffer.from(JSON.stringify(gltf));
  const length = Math.ceil(payload.length / 4) * 4;
  const data = Buffer.alloc(20 + length, 0x20);
  data.write('glTF', 0, 'ascii');
  data.writeUInt32LE(2, 4);
  data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(length, 12);
  data.writeUInt32LE(0x4e4f534a, 16);
  payload.copy(data, 20);
  return data;
}
const valid = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], nodes: [] };
test('accepts a self-contained glTF 2.0 scene', () => {
  assert.deepEqual(inspectGlb(glb(valid)), { meshes: 0, positions: 0, animations: 0 });
});
test('rejects malformed magic, file length, and oversize assets', () => {
  const binary = glb(valid);
  assert.throws(() => inspectGlb(Buffer.concat([Buffer.from('nope'), binary.subarray(4)])), /magic/);
  assert.throws(() => inspectGlb(binary.subarray(0, binary.length - 4)), /length/);
  assert.throws(() => inspectGlb(binary, 10), /size/);
});
test('rejects remote buffers and texture URIs', () => {
  assert.throws(() => inspectGlb(glb({ ...valid, images: [{ uri: 'https://example.com/track.png' }] })), /External asset URI/);
  assert.throws(() => inspectGlb(glb({ ...valid, buffers: [{ uri: '../secret.bin' }] })), /External asset URI/);
});
test('enforces mesh vertex budget and supported required extensions', () => {
  const large = { ...valid, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 160_001 }] };
  assert.throws(() => inspectGlb(glb(large)), /Geometry exceeds/);
  assert.throws(() => inspectGlb(glb({ ...valid, extensionsRequired: ['KHR_unknown'] })), /Unsupported mandatory/);
});
