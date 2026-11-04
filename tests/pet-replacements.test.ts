import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { petReplacements, replacementFor } from '../lib/pet-replacements';
import { animalCandidateIds } from '../lib/species-3d';
import { resolvePetClip } from '../lib/pet-animation';
import { validateLocalGlb } from '../lib/validate-local-glb';

test('registry covers all 17 categories and retains real fallback artwork', () => {
  assert.equal(Object.keys(petReplacements).length, 17);
  assert.deepEqual(Object.keys(petReplacements).sort(), [...animalCandidateIds].sort());
  for (const [id, asset] of Object.entries(petReplacements)) {
    assert.equal(asset.speciesId, id);
    assert.ok(existsSync('public' + asset.fallbackIllustration));
    if (asset.approval !== 'approved') assert.equal(replacementFor(asset.speciesId), null);
    if (asset.approval === 'missing') {
      assert.equal(asset.modelUrl, null);
      continue;
    }
    assert.ok(asset.provenance?.author);
    for (const key of ['sourceUrl', 'downloadUrl', 'licenseUrl'] as const)
      assert.match(asset.provenance![key], /^https:\/\//);
    assert.ok(asset.provenance?.license);
    assert.ok(asset.provenance?.attribution);
    const bytes = readFileSync('public' + asset.modelUrl);
    validateLocalGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.performance?.sha256);
    assert.equal(bytes.length, asset.performance?.bytes);
    const doc = JSON.parse(
      bytes
        .subarray(20, 20 + bytes.readUInt32LE(12))
        .toString()
        .trim(),
    );
    const clips = (doc.animations ?? []).map((a: { name: string }) => a.name);
    assert.deepEqual(clips, asset.clips);
    for (const [activity, aliases] of Object.entries(asset.aliases)) {
      for (const alias of aliases)
        assert.ok(clips.includes(alias), id + ' missing actual alias ' + alias);
      if (aliases.length)
        assert.ok(resolvePetClip(clips, activity as keyof typeof asset.aliases, asset.aliases));
    }
    if (asset.clips.length)
      assert.ok(
        doc.skins?.length ||
          doc.meshes?.some((m: { primitives: { targets?: unknown[] }[] }) =>
            m.primitives.some((p) => p.targets?.length),
          ),
      );
    if (asset.approval === 'approved') assert.ok(Object.values(asset.review).every(Boolean));
  }
});

test('preview gate never promotes missing, unlicensed or unreviewed assets', () => {
  const original = petReplacements.cat;
  try {
    petReplacements.cat = { ...original, modelUrl: '/missing.glb', approval: 'approved' };
    assert.equal(replacementFor('cat'), null);
    petReplacements.cat = {
      ...original,
      approval: 'experimental',
      modelUrl: '/missing.glb',
      review: {
        licenseVerified: false,
        structureVerified: true,
        visualVerified: true,
        browserVerified: true,
      },
    };
    assert.equal(replacementFor('cat', true), null);
  } finally {
    petReplacements.cat = original;
  }
});
