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
      ? ['continuous feathered wing left', 'continuous feathered wing right']
      : kind === 'fish'
        ? ['sculpted caudal fin', 'sculpted dorsal fin']
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
  // Every species now has a distinct coloured iris behind the dark pupil.
  const irisNodes = entries.filter(
    (node) => node.name?.includes(species + ' ') && node.name?.endsWith(' iris'),
  );
  assert.equal(irisNodes.length, 2, species + ' must export two skinned iris surfaces');
  if (kind !== 'fish' && kind !== 'snake') {
    for (const side of ['left', 'right']) {
      const lid = entries.find((node) => node.name === species + ' ' + side + ' upper eyelid');
      assert.ok(lid, species + ' missing articulated ' + side + ' eyelid');
      const targets = gltf.meshes[lid.mesh]?.extras?.targetNames ?? [];
      assert.ok(targets.includes('Eye_Wide'), species + ' missing eyelid curiosity morph');
      assert.ok(
        targets.includes('Blink_' + (side === 'left' ? 'L' : 'R')),
        species + ' missing eyelid close morph',
      );
      assert.ok(
        (gltf.meshes[lid.mesh]?.primitives ?? []).some(
          (part) =>
            part.attributes?.JOINTS_0 !== undefined && part.attributes?.WEIGHTS_0 !== undefined,
        ),
        species + ' eyelid is not skinned to the skull',
      );
    }
  } else {
    assert.ok(
      !nodes.some((name) => name.endsWith('upper eyelid')),
      species + ' must not be given mammalian blinking eyelids',
    );
  }
  if (kind === 'quadruped' || kind === 'reptile') {
    // Anatomically connected cranium and muzzle, not two overlapping balls.
    assert.ok(
      !entries.some((node) => node.name === species + ' muzzle'),
      species + ': old detached muzzle returned',
    );
    const head = entries.find((node) => node.name === 'Skinned ' + species + ' skull');
    assert.ok(head, species + ': missing unified cranium/cheek/rostrum');
    const headParts = gltf.meshes[head.mesh]?.primitives ?? [];
    assert.ok(
      headParts.some(
        (part) =>
          part.attributes?.JOINTS_0 !== undefined &&
          part.attributes?.WEIGHTS_0 !== undefined &&
          part.attributes?.TEXCOORD_0 !== undefined &&
          (gltf.accessors?.[part.attributes.POSITION]?.count ?? 0) >= 1900,
      ),
      species + ': skull must be substantial continuous skinned topology',
    );
    for (const node of entries.filter((n) => n.name?.endsWith('connected limb'))) {
      const mesh = gltf.meshes[node.mesh];
      assert.ok(
        (mesh?.primitives ?? []).some((part) => part.attributes?.TEXCOORD_0 !== undefined),
        species + ' limb missing UVs for directional coat/skin rendering',
      );
    }
  }
  if (['dog', 'rabbit', 'fish', 'angelfish'].includes(species)) {
    for (const fragment of [
      'left rosy cheek',
      'right rosy cheek',
      'left sparkling eye highlight',
      'right sparkling eye highlight',
    ]) {
      assert.ok(
        nodes.some((name) => name.includes(species + ' ') && name.endsWith(fragment)),
        species + ' missing reference-inspired facial geometry: ' + fragment,
      );
    }
    assert.ok(
      nodes.some((name) => name.includes('tongue')),
      species + ' missing joyful tongue',
    );
    const mouth = entries.find((node) => node.name === species + ' eating mouth');
    assert.ok(mouth, species + ' missing original animated mouth');
    assert.ok(
      (gltf.meshes[mouth.mesh]?.extras?.targetNames ?? []).includes('Smile'),
      species + ' missing actual morph-target cheerful expression',
    );
    const frontPreview = join(output, species + '-front-review.png');
    assert.ok(
      existsSync(frontPreview) && statSync(frontPreview).size > 3000,
      species + ' missing true front-facing Blender quality preview',
    );
    if (species === 'dog' || species === 'rabbit') {
      const toes = nodes.filter(
        (name) => name.includes(species + ' ') && name.includes(' plush toe '),
      );
      assert.equal(
        toes.length,
        12,
        species + ' requires distinct rounded toes on all four skinned paws',
      );
      const earInners = nodes.filter(
        (name) => name.includes(species + ' ') && name.includes('inner ear'),
      );
      assert.equal(earInners.length, 2, species + ' requires two anatomically shaped ear insets');
    }
    if (species === 'fish' || species === 'angelfish') {
      assert.ok(
        nodes.some((name) => name === species + ' round contrasting smiling face'),
        species + ' missing bright cream fish face',
      );
    }
  }
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
