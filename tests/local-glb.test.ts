import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLocalGlb } from '../lib/validate-local-glb';

function makeGlb(doc: Record<string, unknown>, binary?: Uint8Array) {
  const json = JSON.stringify(doc);
  const padding = (4 - (json.length % 4)) % 4;
  const body = Buffer.from(json + ' '.repeat(padding), 'utf8');
  const binaryLength = binary ? Math.ceil(binary.byteLength / 4) * 4 : 0;
  const bytes = Buffer.alloc(20 + body.length + (binary ? 8 + binaryLength : 0));
  bytes.write('glTF', 0, 4, 'ascii');
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.byteLength, 8);
  bytes.writeUInt32LE(body.byteLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  body.copy(bytes, 20);
  if (binary) {
    bytes.writeUInt32LE(binaryLength, 20 + body.length);
    bytes.writeUInt32LE(0x004e4942, 24 + body.length);
    bytes.set(binary, 28 + body.length);
  }
  return Uint8Array.from(bytes).buffer;
}

const valid = { asset: { version: '2.0' }, scenes: [{}] };

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
test('accepts a complete high-detail mesh beyond the former file and vertex budgets', () => {
  const count = 800_001;
  const binary = new Uint8Array(count * 12);
  assert.doesNotThrow(() =>
    validateLocalGlb(
      makeGlb(
        {
          ...valid,
          scenes: [{ nodes: [0] }],
          nodes: [{ mesh: 0 }],
          buffers: [{ byteLength: binary.byteLength }],
          bufferViews: [{ buffer: 0, byteLength: binary.byteLength }],
          accessors: [{ bufferView: 0, count, type: 'VEC3', componentType: 5126 }],
          meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        },
        binary,
      ),
    ),
  );
});
test('requires a real BIN chunk and validates binary buffer bounds', () => {
  assert.throws(
    () => validateLocalGlb(makeGlb({ ...valid, buffers: [{ byteLength: 4 }] })),
    /missing its BIN/,
  );
  assert.throws(
    () => validateLocalGlb(makeGlb({ ...valid, buffers: [{ byteLength: 8 }] }, new Uint8Array(4))),
    /does not match/,
  );
  assert.throws(
    () =>
      validateLocalGlb(
        makeGlb(
          {
            ...valid,
            buffers: [{ byteLength: 4 }],
            bufferViews: [{ buffer: 0, byteOffset: 4, byteLength: 4 }],
          },
          new Uint8Array(4),
        ),
      ),
    /buffer bounds/,
  );
});
test('rejects truncated chunks and duplicate JSON chunks', () => {
  const complete = Buffer.from(
    makeGlb({ ...valid, buffers: [{ byteLength: 8 }] }, new Uint8Array(8)),
  );
  const truncated = complete.subarray(0, complete.length - 4);
  truncated.writeUInt32LE(truncated.length, 8);
  assert.throws(() => validateLocalGlb(Uint8Array.from(truncated).buffer), /Truncated/);
  const json = Buffer.from(makeGlb(valid));
  const duplicate = Buffer.concat([json, json.subarray(12)]);
  duplicate.writeUInt32LE(duplicate.length, 8);
  assert.throws(() => validateLocalGlb(Uint8Array.from(duplicate).buffer), /Multiple GLB JSON/);
});
test('supports built-in PBR extensions and rejects compression without installed decoders', () => {
  assert.doesNotThrow(() =>
    validateLocalGlb(
      makeGlb({
        ...valid,
        extensionsRequired: ['KHR_mesh_quantization', 'KHR_materials_transmission'],
      }),
    ),
  );
  for (const name of [
    'KHR_draco_mesh_compression',
    'KHR_texture_basisu',
    'EXT_meshopt_compression',
    'KHR_meshopt_compression',
  ])
    assert.throws(
      () => validateLocalGlb(makeGlb({ ...valid, extensionsRequired: [name] })),
      /unsupported GLB extension/,
    );
});
