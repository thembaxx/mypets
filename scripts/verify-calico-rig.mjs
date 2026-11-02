import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const filename = process.argv[2];
if (!filename) throw new Error('Pass an actual .glb file from Blender');
const bytes = readFileSync(filename);
assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'The candidate must be a binary GLB');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const doc = JSON.parse(
  bytes
    .subarray(20, 20 + bytes.readUInt32LE(12))
    .toString('utf8')
    .trim(),
);
assert.ok(doc.nodes?.length > 12, 'Require articulated node hierarchy');
assert.ok(
  doc.skins?.some((skin) => skin.joints?.length >= 12),
  'Require actual exported skin and skeleton',
);
const actualNames = (doc.animations ?? []).map((clip) => clip.name || '');
const expected = ['Idle', 'Walk', 'Eat', 'Play', 'Rest', 'Groom', 'Sniff'];
for (const clip of expected)
  assert.ok(
    actualNames.some((name) => name.toLowerCase().includes(clip.toLowerCase())),
    `Rigged model must expose separate authored clip ${clip}; found ${actualNames.join(', ')}`,
  );
const morphs = (doc.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []);
// The shipping candidate must contain each one-piece limb and must not
// regress to individually skinned floating shoulder/paw spheres.
for (const label of ['Front_L', 'Front_R', 'Rear_L', 'Rear_R']) {
  assert.ok(
    (doc.meshes ?? []).some((mesh) => mesh.name?.includes(label + ' lower paw')),
    `Missing connected anatomical limb ${label}`,
  );
  assert.ok(
    !(doc.meshes ?? []).some((mesh) => mesh.name?.includes(label + ' shoulder')),
    `The separated shoulder mesh returned for ${label}`,
  );
}
assert.ok(
  (doc.meshes ?? []).filter((mesh) => mesh.name?.startsWith('Fur ')).length >= 5,
  'Review candidate must include batched sculpted silhouette fur',
);
for (const key of [
  'Blink_L',
  'Blink_R',
  'Eye_Wide',
  'Jaw_Open',
  'Lick',
  'Smile',
  'Cheek_Puff',
  'Sniff',
])
  assert.ok(
    morphs.includes(key),
    `Expected animated facial geometry ${key}; available: ${morphs.join(', ')}`,
  );
assert.ok(
  (doc.meshes ?? []).some((mesh) =>
    (mesh.primitives ?? []).some(
      (part) => part.attributes?.JOINTS_0 !== undefined && part.attributes?.WEIGHTS_0 !== undefined,
    ),
  ),
  'Require skinned geometry, not static images or baked sprite planes',
);
// Verify the actual binary skin weights, not just the presence of joints.
// At least hundreds of vertices must blend two real bones with nontrivial
// weights; a collection of individually rigid moving spheres does not qualify.
const jsonLength = bytes.readUInt32LE(12);
let chunk = 20 + jsonLength;
let binaryStart = -1;
while (chunk + 8 <= bytes.length) {
  const byteLength = bytes.readUInt32LE(chunk);
  const kind = bytes.readUInt32LE(chunk + 4);
  if (kind === 0x004e4942) {
    binaryStart = chunk + 8;
    break;
  }
  chunk += 8 + byteLength;
}
assert.ok(binaryStart >= 0, 'GLB should embed its actual vertex buffers');
// Test the *exported binary morph deltas*. Requiring named targets alone used
// to accept Eye_Wide/Blink targets that translated pupils several metres
// because the authoring shape keys scaled absolute world positions.
let checkedFacialTargets = 0;
for (const mesh of doc.meshes ?? []) {
  const targetNames = mesh.extras?.targetNames ?? [];
  for (const part of mesh.primitives ?? []) {
    for (const [index, target] of (part.targets ?? []).entries()) {
      const label = targetNames[index];
      if (!label || target.POSITION === undefined) continue;
      const accessor = doc.accessors?.[target.POSITION];
      const view = doc.bufferViews?.[accessor?.bufferView];
      assert.ok(accessor && view, `Morph target ${label} requires a binary accessor`);
      assert.equal(accessor.type, 'VEC3', `Morph target ${label} must export 3D offsets`);
      assert.equal(
        accessor.componentType,
        5126,
        `Morph target ${label} requires float coordinates`,
      );
      const stride = view.byteStride ?? 12;
      const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let n = 0; n < accessor.count; n++) {
        const position = start + n * stride;
        const delta = Math.hypot(
          bytes.readFloatLE(position),
          bytes.readFloatLE(position + 4),
          bytes.readFloatLE(position + 8),
        );
        assert.ok(
          Number.isFinite(delta) && delta <= 0.21,
          `Morph ${label} has an escaped vertex offset ${delta.toFixed(3)}m on ${mesh.name}`,
        );
      }
      checkedFacialTargets++;
    }
  }
}
assert.ok(checkedFacialTargets >= 8, 'Validate every exported facial expression delta');
let blendedVertices = 0;
let maxInfluenceCount = 0;
for (const mesh of doc.meshes ?? []) {
  for (const part of mesh.primitives ?? []) {
    const index = part.attributes?.WEIGHTS_0;
    if (index === undefined) continue;
    const accessor = doc.accessors?.[index];
    const view = doc.bufferViews?.[accessor?.bufferView];
    assert.ok(accessor && view, 'Mesh skin weights require an embedded bufferView');
    assert.equal(accessor.type, 'VEC4');
    const componentBytes =
      accessor.componentType === 5126
        ? 4
        : accessor.componentType === 5123
          ? 2
          : accessor.componentType === 5121
            ? 1
            : 0;
    assert.ok(componentBytes > 0, 'Unsupported skin weight component format');
    const stride = view.byteStride ?? componentBytes * 4;
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let n = 0; n < accessor.count; n++) {
      let active = 0;
      for (let lane = 0; lane < 4; lane++) {
        const offset = start + n * stride + lane * componentBytes;
        let weight =
          accessor.componentType === 5126
            ? bytes.readFloatLE(offset)
            : accessor.componentType === 5123
              ? bytes.readUInt16LE(offset) / 65535
              : bytes.readUInt8(offset) / 255;
        if (weight > 0.08) active++;
      }
      if (active > 1) blendedVertices++;
      maxInfluenceCount = Math.max(maxInfluenceCount, active);
    }
  }
}
assert.ok(
  blendedVertices >= 160,
  `Need real multi-bone deforming fur surface; observed ${blendedVertices} blended vertices`,
);

assert.ok(bytes.length <= 8 * 1024 * 1024);
console.log(
  JSON.stringify(
    {
      asset: filename,
      bytes: bytes.length,
      skins: doc.skins.length,
      animations: actualNames,
      morphs,
      meshes: doc.meshes.length,
      blendedVertices,
      maxInfluenceCount,
      checkedFacialTargets,
    },
    null,
    2,
  ),
);
