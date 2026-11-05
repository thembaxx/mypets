// Reference-bunny contract: validates a real skin, ten authored actions and facial geometry.
// It intentionally does NOT infer visual fidelity from structural validity.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGlb } from './validate-3d-assets.mjs';

export const BUNNY_ACTIONS = Object.freeze([
  'Idle',
  'Walk',
  'Hop',
  'Sit',
  'LieDown',
  'Sleep',
  'Happy',
  'Sad',
  'Play',
  'PetReaction',
]);
export const BUNNY_MORPHS = Object.freeze([
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeWide_L',
  'eyeWide_R',
  'browSad_L',
  'browSad_R',
  'mouthSmile',
  'mouthOpen',
  'mouthFrown',
  'cheekPuff',
  'muzzleRaise_L',
  'muzzleRaise_R',
  'noseScrunch',
]);

export function readGlbJson(bytes) {
  // First run the repository's existing header, bounds, URI and extension checks.
  inspectGlb(bytes);
  const length = bytes.readUInt32LE(12);
  assert.ok(length > 0 && length % 4 === 0, 'Invalid JSON chunk length');
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First chunk must contain JSON');
  return JSON.parse(
    bytes
      .subarray(20, 20 + length)
      .toString('utf8')
      .trim(),
  );
}

export function validateReferenceBunny(gltf) {
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];
  const accessors = gltf.accessors ?? [];
  const skins = gltf.skins ?? [];
  const animations = gltf.animations ?? [];
  assert.ok(nodes.length && meshes.length, 'Bunny is missing geometry');
  assert.ok(skins.length >= 1, 'Bunny must be a real skeletal model');
  const jointIds = new Set();
  for (const skin of skins) {
    assert.ok(
      Array.isArray(skin.joints) && skin.joints.length >= 16,
      'Bunny skin needs a meaningful multi-bone skeleton (>= 16 joints)',
    );
    for (const joint of skin.joints) {
      assert.ok(Number.isInteger(joint) && nodes[joint], 'Skin references an invalid bone');
      jointIds.add(joint);
    }
    assert.ok(Number.isInteger(skin.inverseBindMatrices), 'Skin requires inverse bind matrices');
    assert.equal(
      accessors[skin.inverseBindMatrices]?.count,
      skin.joints.length,
      'Inverse bind matrix count must match joint count',
    );
  }
  assert.ok(
    nodes.some((node) => Number.isInteger(node.skin) && skins[node.skin]),
    'A scene node must actually use the skeleton',
  );

  const primitives = meshes.flatMap((mesh) => mesh.primitives ?? []);
  assert.ok(
    primitives.some(
      (p) =>
        p.attributes?.JOINTS_0 !== undefined &&
        p.attributes?.WEIGHTS_0 !== undefined &&
        p.attributes?.POSITION !== undefined,
    ),
    'Real deformable geometry with joint weights is required',
  );
  const vertexCount = primitives.reduce(
    (n, p) => n + (accessors[p.attributes?.POSITION]?.count ?? 0),
    0,
  );
  assert.ok(vertexCount >= 3000, 'Insufficient character geometry for the reference-detail target');

  const morphNames = new Set();
  for (const mesh of meshes) {
    const names = mesh.extras?.targetNames ?? [];
    for (const name of names) morphNames.add(name);
    const targets = mesh.primitives?.[0]?.targets ?? [];
    if (names.length) {
      assert.equal(
        names.length,
        targets.length,
        'Every named shape key must have exported target geometry',
      );
      for (const target of targets) {
        assert.ok(
          Number.isInteger(target.POSITION) && accessors[target.POSITION],
          'Morph target must change actual vertex positions',
        );
      }
    }
  }
  for (const name of BUNNY_MORPHS) {
    assert.ok(morphNames.has(name), 'Missing required facial morph: ' + name);
  }

  const clipNames = animations.map((a) => a.name);
  assert.equal(new Set(clipNames).size, clipNames.length, 'Duplicate clip names');
  for (const name of BUNNY_ACTIONS) {
    const clip = animations.find((a) => a.name === name);
    assert.ok(clip, 'Missing bunny action: ' + name);
    assert.ok(clip.channels?.length >= 2, name + ' must animate several channels');
    const boneChannels = clip.channels.filter(
      (channel) =>
        jointIds.has(channel.target?.node) &&
        ['rotation', 'translation', 'scale'].includes(channel.target?.path),
    );
    assert.ok(
      boneChannels.length >= 2,
      name + ' must animate skeletal bones; static placeholder clips are rejected',
    );
    const timeRanges = (clip.samplers ?? [])
      .map((sample) => accessors[sample.input])
      .filter(Boolean)
      .filter((input) => input.min && input.max);
    assert.ok(
      timeRanges.some((input) => input.max[0] - input.min[0] > 0.05),
      name + ' must have a nonzero authored timeline',
    );
  }

  return {
    vertexCount,
    joints: jointIds.size,
    morphs: [...morphNames].sort(),
    clips: clipNames,
    structuralPass: true,
    visualPass: false, // Never infer this without side-by-side render inspection.
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node scripts/validate-reference-bunny.mjs path/to/bunny.glb');
    process.exitCode = 2;
  } else {
    try {
      const report = validateReferenceBunny(readGlbJson(readFileSync(filename)));
      console.log(JSON.stringify(report, null, 2));
      console.log('STRUCTURAL_PASS — visual review and Blender round-trip are still required.');
    } catch (error) {
      console.error('BUNNY_VALIDATION_FAILED:', error.message);
      process.exitCode = 1;
    }
  }
}
