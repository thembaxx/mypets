import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Verify actual exported, animated and skinned geometry. This is a structural
 * test, not proof of lifelike behavior, believable feathers or fish anatomy.
 */
const directory = process.argv[2];
assert.ok(directory, 'Pass generated Blender candidate directory');
const birds = ['bird', 'budgie', 'canary', 'chicken'];
const fish = ['fish', 'angelfish'];

function meshNode(doc, expected, slug) {
  const entry = (doc.nodes ?? []).find(
    (node) => node.name?.includes(expected) && Number.isInteger(node.mesh),
  );
  assert.ok(entry, slug + ': missing mesh-bearing node ' + expected);
  const mesh = doc.meshes[entry.mesh];
  assert.ok(mesh?.primitives?.length, slug + ': no primitives for ' + expected);
  assert.ok(
    mesh.primitives.some((part) =>
      part.attributes?.JOINTS_0 !== undefined &&
      part.attributes?.WEIGHTS_0 !== undefined &&
      (doc.accessors?.[part.attributes?.POSITION]?.count ?? 0) >= 100,
    ),
    slug + ': mesh ' + expected + ' must have substantial animated geometry',
  );
  return entry;
}

for (const species of [...birds, ...fish]) {
  const path = join(directory, species + '.glb');
  assert.ok(existsSync(path), species + ': missing GLB');
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 8 * 1024 * 1024);
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const names = (doc.nodes ?? []).map((node) => node.name ?? '');
  const allJoints = new Set(
    (doc.skins ?? []).flatMap((skin) => skin.joints ?? []).map((index) => names[index]),
  );
  const walk = (doc.animations ?? []).find((animation) =>
    /walk/i.test(animation.name ?? ''),
  );
  assert.ok(walk, species + ': no locomotion animation');
  const animated = new Set((walk.channels ?? []).map((channel) => channel.target?.node));
  const review = join(directory, species + '-review.png');
  assert.ok(existsSync(review) && statSync(review).size > 3000,
    species + ': no genuine Blender review render');
  if (birds.includes(species)) {
    for (const side of ['left', 'right']) {
      meshNode(doc, 'continuous feathered wing ' + side, species);
    }
    for (const joint of ['Wing_L_Tip', 'Wing_R_Tip']) {
      assert.ok(allJoints.has(joint), species + ': missing wing-tip joint ' + joint);
      assert.ok(names.some((name, i) => name === joint && animated.has(i)),
        species + ': articulated wing joint never animated ' + joint);
    }
    assert.ok(!names.some((name) => /wing -1|wing 1/.test(name)),
      species + ': old ellipsoid wing remains');
  } else {
    for (const name of [
      'sculpted caudal fin', 'sculpted dorsal fin',
      'sculpted pectoral fin -1', 'sculpted pectoral fin 1',
    ]) meshNode(doc, name, species);
    assert.ok(allJoints.has('Tail_2'), species + ': no skinned caudal fin joint');
    assert.ok(names.some((name, i) => name === 'Tail_2' && animated.has(i)),
      species + ': tail is not keyed for swimming');
    assert.ok(!names.some((name) => name === species + ' caudal fin'),
      species + ': round ellipsoid caudal fin remains');
  }
  console.log('AVIAN_AQUATIC_EXPORT_PASS', species, {
    meshCount: doc.meshes?.length,
    clips: doc.animations?.length,
    joints: allJoints.size,
  });
}
