import test from 'node:test';
import assert from 'node:assert/strict';
import { BUNNY_ACTIONS, BUNNY_MORPHS, validateReferenceBunny } from './validate-reference-bunny.mjs';

function validFixture() {
  const nodes = Array.from({ length: 16 }, (_, i) => ({ name: 'BunnyBone_' + i }));
  nodes.push({ name: 'BunnySkinnedMesh', mesh: 0, skin: 0 });
  const accessors = [
    { count: 16 }, // inverse bind matrices
    { count: 3600 }, // positions
    { count: 2, min: [0], max: [1] }, // time range
    ...BUNNY_MORPHS.map(() => ({ count: 3600 })), // real position targets
  ];
  const mesh = {
    name: 'BunnyFace',
    extras: { targetNames: [...BUNNY_MORPHS] },
    primitives: [{
      attributes: { JOINTS_0: 1, WEIGHTS_0: 1, POSITION: 1 },
      targets: BUNNY_MORPHS.map((_, i) => ({ POSITION: i + 3 })),
    }],
  };
  const animations = BUNNY_ACTIONS.map((name) => ({
    name,
    samplers: [{ input: 2, output: 1 }],
    channels: [
      { sampler: 0, target: { node: 0, path: 'rotation' } },
      { sampler: 0, target: { node: 1, path: 'translation' } },
    ],
  }));
  return {
    nodes, accessors, meshes: [mesh],
    skins: [{ joints: Array.from({ length: 16 }, (_, i) => i), inverseBindMatrices: 0 }],
    animations,
  };
}

test('accepts the complete skeletal and facial contract', () => {
  const result = validateReferenceBunny(validFixture());
  assert.equal(result.structuralPass, true);
  assert.equal(result.visualPass, false);
  assert.equal(result.clips.length, 10);
  assert.equal(result.morphs.length, BUNNY_MORPHS.length);
});

test('rejects missing bone actions', () => {
  const fixture = validFixture();
  fixture.animations.pop();
  assert.throws(() => validateReferenceBunny(fixture), /PetReaction/);
});

test('rejects missing facial deformation', () => {
  const fixture = validFixture();
  fixture.meshes[0].extras.targetNames.pop();
  fixture.meshes[0].primitives[0].targets.pop();
  assert.throws(() => validateReferenceBunny(fixture), /noseScrunch/);
});

test('rejects fake animation tracks not targeting bones', () => {
  const fixture = validFixture();
  fixture.animations[2].channels.forEach((channel) => {
    channel.target.node = 16;
  });
  assert.throws(() => validateReferenceBunny(fixture), /Hop.*skeletal/);
});

test('rejects skinned meshes without sufficient skeleton joints', () => {
  const fixture = validFixture();
  fixture.skins[0].joints = [0, 1];
  assert.throws(() => validateReferenceBunny(fixture), /multi-bone/);
});
