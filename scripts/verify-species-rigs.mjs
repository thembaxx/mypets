import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const output = process.argv[2];
assert.ok(output, 'Pass output directory containing exported candidate GLBs');
const candidates = {
  dog: 'quadruped',
  rabbit: 'quadruped',
  hamster: 'quadruped',
  'guinea-pig': 'quadruped',
  ferret: 'quadruped',
  hedgehog: 'quadruped',
  chicken: 'bird',
  bird: 'bird',
  budgie: 'bird',
  canary: 'bird',
  fish: 'fish',
  angelfish: 'fish',
  snake: 'snake',
  iguana: 'reptile',
  gecko: 'reptile',
  salamander: 'reptile',
};
const result = [];
for (const [species, kind] of Object.entries(candidates)) {
  const path = join(output, species + '.glb');
  assert.ok(existsSync(path), 'Missing actual exported ' + species + ' GLB');
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 8 * 1024 * 1024, species + ' exceeds 8 MiB');
  const size = bytes.readUInt32LE(12);
  const gltf = JSON.parse(
    bytes
      .subarray(20, 20 + size)
      .toString('utf8')
      .trim(),
  );
  const names = (gltf.animations ?? []).map((a) => a.name.toLowerCase());
  for (const action of ['idle', 'walk', 'eat', 'play', 'rest', 'groom', 'sniff']) {
    assert.ok(
      names.some((name) => name.includes(action)),
      species + ' missing authored ' + action + ' clip',
    );
  }
  assert.ok((gltf.skins ?? []).length > 0, species + ' missing real skeleton');
  assert.ok(
    (gltf.skins ?? []).some((s) => s.joints?.length >= 6),
    species + ' missing articulated bones',
  );
  const entries = (gltf.nodes ?? []).filter((node) => Number.isInteger(node.mesh));
  const nodes = entries.map((n) => n.name ?? '');
  assert.ok(
    nodes.some((name) => name.includes(species + ' torso')),
    species + ' has no individually authored torso mesh',
  );
  for (const name of kind === 'quadruped' || kind === 'reptile'
    ? ['Front_L', 'Front_R', 'Rear_L', 'Rear_R']
    : kind === 'bird'
      ? ['wing -1', 'wing 1']
      : kind === 'fish'
        ? ['caudal fin', 'dorsal fin']
        : ['unbroken spine', 'tapered tail']) {
    assert.ok(
      nodes.some((node) => node.includes(name)),
      species + ' missing distinguishing anatomy ' + name,
    );
  }
  assert.ok(
    (gltf.meshes ?? [])
      .flatMap((mesh) => mesh.primitives ?? [])
      .some(
        (part) =>
          part.attributes?.JOINTS_0 !== undefined && part.attributes?.WEIGHTS_0 !== undefined,
      ),
    species + ' is a static mesh, not a skinned rig',
  );
  const preview = join(output, species + '-review.png');
  assert.ok(
    existsSync(preview) && statSync(preview).size > 2000,
    species + ' has no genuine Blender review image',
  );
  result.push({
    species,
    kind,
    bytes: bytes.length,
    clips: names.length,
    joints: gltf.skins[0].joints.length,
  });
}
assert.equal(result.length, 16);
console.log(JSON.stringify({ status: 'EXPERIMENTAL_RIGS_VERIFIED', candidates: result }, null, 2));
