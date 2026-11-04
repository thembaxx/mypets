import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlb } from './validate-3d-assets.mjs';

function glb(gltf, binary) {
  const payload = Buffer.from(JSON.stringify(gltf));
  const length = Math.ceil(payload.length / 4) * 4;
  const binaryLength = binary ? Math.ceil(binary.byteLength / 4) * 4 : 0;
  const data = Buffer.alloc(20 + length + (binary ? 8 + binaryLength : 0), 0x20);
  data.write('glTF', 0, 'ascii');
  data.writeUInt32LE(2, 4);
  data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(length, 12);
  data.writeUInt32LE(0x4e4f534a, 16);
  payload.copy(data, 20);
  if (binary) {
    data.writeUInt32LE(binaryLength, 20 + length);
    data.writeUInt32LE(0x004e4942, 24 + length);
    data.set(binary, 28 + length);
  }
  return data;
}
const valid = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], nodes: [] };
test('accepts a self-contained glTF 2.0 scene', () => {
  assert.deepEqual(inspectGlb(glb(valid)), { meshes: 0, positions: 0, animations: 0 });
});
test('rejects malformed magic and file length', () => {
  const binary = glb(valid);
  assert.throws(
    () => inspectGlb(Buffer.concat([Buffer.from('nope'), binary.subarray(4)])),
    /magic/,
  );
  assert.throws(() => inspectGlb(binary.subarray(0, binary.length - 4)), /length/);
});
test('rejects remote buffers and texture URIs', () => {
  assert.throws(
    () => inspectGlb(glb({ ...valid, images: [{ uri: 'https://example.com/track.png' }] })),
    /External asset URI/,
  );
  assert.throws(
    () => inspectGlb(glb({ ...valid, buffers: [{ uri: '../secret.bin' }] })),
    /External asset URI/,
  );
});
test('accepts real binary geometry beyond former arbitrary budgets', () => {
  const count = 800_001;
  const binary = new Uint8Array(count * 12);
  const large = {
    ...valid,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [{ buffer: 0, byteLength: binary.byteLength }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, count, type: 'VEC3', componentType: 5126 }],
  };
  assert.equal(inspectGlb(glb(large, binary)).positions, count);
});
test('rejects unsupported required extensions and compression without configured decoders', () => {
  for (const extension of [
    'KHR_unknown',
    'KHR_draco_mesh_compression',
    'KHR_texture_basisu',
    'EXT_meshopt_compression',
    'KHR_meshopt_compression',
  ])
    assert.throws(
      () => inspectGlb(glb({ ...valid, extensionsRequired: [extension] })),
      /Unsupported mandatory/,
    );
});
test('requires an embedded BIN chunk with matching buffer and view bounds', () => {
  assert.throws(() => inspectGlb(glb({ ...valid, buffers: [{ byteLength: 4 }] })), /missing BIN/);
  assert.throws(
    () => inspectGlb(glb({ ...valid, buffers: [{ byteLength: 8 }] }, new Uint8Array(4))),
    /does not match/,
  );
  assert.throws(
    () =>
      inspectGlb(
        glb(
          { ...valid, buffers: [{ byteLength: 4 }], bufferViews: [{ buffer: 0, byteLength: 8 }] },
          new Uint8Array(4),
        ),
      ),
    /buffer bounds/,
  );
});
