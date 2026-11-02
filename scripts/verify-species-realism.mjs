import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
assert.ok(out, 'Pass the species export directory');

for (const species of ['dog', 'rabbit']) {
  const path = join(out, species + '.glb');
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const length = bytes.readUInt32LE(12);
  const doc = JSON.parse(
    bytes
      .subarray(20, 20 + length)
      .toString('utf8')
      .trim(),
  );
  const nodes = (doc.nodes ?? []).map((node) => node.name ?? '');
  assert.equal(nodes.filter((name) => name.includes(species + ' cupped ear')).length, 2);
  assert.equal(nodes.filter((name) => name.endsWith('connected limb')).length, 4);
  assert.ok(
    (doc.materials ?? []).filter((material) => material.normalTexture !== undefined).length >= 2,
    species + ': exported body AND pale fur must both reference PBR coat normal maps',
  );
  const image = (doc.images ?? []).find((item) =>
    (item.name ?? '').includes(species + '-coat-normal'),
  );
  assert.ok(image?.bufferView !== undefined, species + ': baked normal PNG must be embedded');
  const view = doc.bufferViews[image.bufferView];
  assert.ok(view?.byteLength >= 1400, species + ': missing substantive fur normal pixels');
  const joints = (doc.skins ?? []).flatMap((skin) => skin.joints ?? []);
  const jointNames = joints.map((index) => nodes[index]);
  for (const joint of ['Front_L_Lower', 'Front_R_Lower', 'Rear_L_Lower', 'Rear_R_Lower']) {
    assert.ok(jointNames.includes(joint), species + ': no separate articulated ' + joint);
  }
  const walk = (doc.animations ?? []).find((animation) => /walk/i.test(animation.name ?? ''));
  assert.ok(walk, species + ': missing authored walking clip');
  const animatedNodes = new Set((walk.channels ?? []).map((channel) => channel.target?.node));
  for (const joint of ['Front_L_Lower', 'Rear_L_Lower']) {
    assert.ok(
      (doc.nodes ?? []).some((node, index) => node.name === joint && animatedNodes.has(index)),
      species + ': lower-leg joints are not keyed in gait',
    );
  }
  const src = join(out, species + '-coat-normal.png');
  assert.ok(existsSync(src), species + ': original coat bake is missing');
  const png = readFileSync(src);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.ok(png.length >= 1400, species + ': coat bake is suspiciously flat');
  console.log('SPECIES_REALISM_STRUCTURAL_PASS', species, {
    cuppedEars: 2,
    limbs: 4,
    pbrMaterials: 2,
    animatedDistalBones: 4,
    pngBytes: png.length,
  });
}
