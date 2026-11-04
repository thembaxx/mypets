import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Receipt = {
  status: string;
  defaultIllustrationsReplaced: boolean;
  sourceBlenderRun: number;
  originalImageSHA256AndEditableSources: Record<
    string,
    { image: string; blender: string; glb: string }
  >;
};

const manifest = JSON.parse(
  readFileSync(new URL('../assets/blender-source/chibi/review-manifest.json', import.meta.url), 'utf8'),
) as Receipt;
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

test('the published original-derived references remain entirely unapproved', () => {
  assert.equal(manifest.status, 'EXPERIMENTAL_UNAPPROVED');
  assert.equal(manifest.defaultIllustrationsReplaced, false);
  assert.equal(manifest.sourceBlenderRun, 41858388785);
  assert.deepEqual(Object.keys(manifest.originalImageSHA256AndEditableSources), [
    'cat',
    'dog',
    'rabbit',
  ]);
});

for (const species of ['cat', 'dog', 'rabbit']) {
  test(`${species} real Blender sources, original art and rigged GLB match source-reviewed SHA-256`, () => {
    const receipt = manifest.originalImageSHA256AndEditableSources[species];
    const jpg = readFileSync(
      new URL(`../assets/animal-originals/${species}.jpg`, import.meta.url),
    );
    const blender = readFileSync(
      new URL(`../assets/blender-source/chibi/${species}.blend`, import.meta.url),
    );
    const glb = readFileSync(
      new URL(`../public/models/candidates/chibi/${species}.glb`, import.meta.url),
    );
    assert.equal(sha256(jpg), receipt.image, 'original JPG unexpectedly changed');
    assert.equal(sha256(blender), receipt.blender, 'editable Blender master changed');
    assert.equal(sha256(glb), receipt.glb, 'published unapproved GLB changed');
    assert.ok(blender.subarray(0, 7).equals(Buffer.from('BLENDER')));
    assert.equal(glb.toString('ascii', 0, 4), 'glTF');
    assert.equal(glb.readUInt32LE(4), 2);
    assert.equal(glb.readUInt32LE(8), glb.byteLength);
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
    assert.ok(json.skins?.length > 0, 'missing actual skeleton');
    const clips = (json.animations ?? []).map((x: { name?: string }) => x.name);
    for (const clip of ['Idle', 'Walk', 'Eat', 'Play', 'Rest', 'Groom', 'Sniff']) {
      assert.ok(clips.includes(clip), `missing ${clip} clip`);
    }
    const meshes = (json.meshes ?? []).flatMap(
      (mesh: { primitives?: { attributes?: Record<string, number>; targets?: unknown[] }[] }) =>
        mesh.primitives ?? [],
    );
    assert.ok(
      meshes.some(
        (mesh: { attributes?: Record<string, number> }) =>
          mesh.attributes?.JOINTS_0 !== undefined && mesh.attributes?.WEIGHTS_0 !== undefined,
      ),
      'rig skeleton has no skinning weights',
    );
    assert.ok(meshes.some((mesh: { targets?: unknown[] }) => (mesh.targets?.length ?? 0) > 0));
    // An exported 3D file does NOT constitute a human likeness approval.
  });
}
