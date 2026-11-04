import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const directory = process.argv[2];
assert.ok(directory, 'Pass generated Blender chibi model directory');
const digests = new Set();
for (const species of ['cat', 'dog', 'rabbit']) {
  const filename = join(directory, species + '.glb');
  assert.ok(existsSync(filename), species + ' missing actual rigged GLB');
  const bytes = readFileSync(filename);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length > 12000, species + ' missing full-detail GLB');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.ok(!digests.has(digest), species + ' is a duplicate animal GLB');
  digests.add(digest);

  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const nodes = gltf.nodes ?? [];
  const meshNodes = nodes.filter((node) => Number.isInteger(node.mesh));
  const clips = (gltf.animations ?? []).map((clip) => clip.name.toLowerCase());
  for (const action of ['idle', 'walk', 'eat', 'play', 'rest', 'groom', 'sniff']) {
    assert.ok(
      clips.some((name) => name.includes(action)),
      species + ' missing ' + action,
    );
  }
  assert.ok((gltf.skins ?? []).some((skin) => skin.joints.length >= 8));
  const skinned = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  assert.ok(
    skinned.some(
      (part) =>
        part.attributes?.JOINTS_0 !== undefined &&
        part.attributes?.WEIGHTS_0 !== undefined &&
        part.attributes?.TEXCOORD_0 !== undefined,
    ),
    species + ' lacks real UV-mapped skinned geometry',
  );
  for (const part of [
    'oversized plush head',
    'round skinned plush torso',
    'smiling eye arc',
    'lifted paw arm L',
    'lifted paw arm R',
    'tiny rounded foot L',
    'tiny rounded foot R',
    'joyful open mouth',
    'pink happy tongue',
  ]) {
    assert.ok(
      meshNodes.some((node) => node.name?.includes(part)),
      species + ' missing chibi character feature: ' + part,
    );
  }
  const mouth = meshNodes.find((node) => node.name === species + ' joyful open mouth');
  assert.ok(mouth);
  const targets = gltf.meshes[mouth.mesh]?.extras?.targetNames ?? [];
  assert.ok(
    targets.includes('Smile') && targets.includes('Jaw_Open'),
    species + ' mouth needs real exported expression morphs',
  );

  const expectedClosedEye =
    species === 'rabbit' ? ' right smiling eye arc' : ' left smiling eye arc';
  const eye = meshNodes.find((node) => node.name === species + expectedClosedEye);
  assert.ok(eye, species + ' missing its source-matched deformable curved eye');
  if (species === 'rabbit') {
    assert.ok(
      meshNodes.some((node) => node.name === 'rabbit original rabbit open cocoa eye'),
      "Rabbit must preserve the original artwork's one open eye and one closed eye",
    );
  }
  const eyeTargets = gltf.meshes[eye.mesh]?.extras?.targetNames ?? [];
  assert.ok(
    eyeTargets.includes('Smile') && eyeTargets.includes('Eye_Wide'),
    species + ' cheerful and curious eyes must have actual vertex morphs',
  );
  const cheek = meshNodes.find((node) => node.name === species + ' cheek -1');
  assert.ok(cheek, species + ' missing sculpted cheek');
  assert.ok(
    (gltf.meshes[cheek.mesh]?.extras?.targetNames ?? []).includes('Cheek_Puff'),
    species + ' face must support animated cheek emotion',
  );
  const editable = join(directory, species + '.blend');
  assert.ok(
    existsSync(editable) && statSync(editable).size > 1000,
    species + ' missing editable Blender rig with packed source art',
  );
  for (const pose of ['idle', 'play', 'jump']) {
    const review = join(directory, species + '-' + pose + '-review.png');
    assert.ok(
      existsSync(review) && statSync(review).size > 3000,
      species + ' missing Blender-rendered ' + pose + ' pose',
    );
  }
  console.log('CHIBI_RIGGED_REVIEW_PASS', species, bytes.length, clips.length);
}
assert.equal(digests.size, 3);
