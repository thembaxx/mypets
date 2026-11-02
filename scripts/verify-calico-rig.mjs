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
const expected = ['Idle', 'Walk', 'Eat', 'Play', 'Rest'];
for (const clip of expected)
  assert.ok(
    actualNames.some((name) => name.toLowerCase().includes(clip.toLowerCase())),
    `Rigged model must expose separate authored clip ${clip}; found ${actualNames.join(', ')}`,
  );
const morphs = (doc.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? []);
for (const key of ['Blink_L', 'Blink_R', 'Jaw_Open', 'Lick'])
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
    },
    null,
    2,
  ),
);
