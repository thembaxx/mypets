import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speciesList, animalAsset } from '../lib/species';
import {
  animalCandidateIds,
  candidateDisplayName,
  candidateModelUrl,
  candidateIsApproved,
} from '../lib/species-3d';

test('every actual MyPets species has an isolated unapproved rigged GLB candidate', () => {
  assert.equal(speciesList.length, 14);
  for (const species of speciesList) {
    assert.ok(animalCandidateIds.includes(species));
    assert.ok(candidateModelUrl(species).endsWith('.glb'));
    assert.equal(candidateIsApproved(species), false);
  }
  assert.equal(new Set(animalCandidateIds).size, 17);
});

test('real illustration breed variants resolve to distinct candidates', () => {
  assert.equal(animalAsset('fish', 'angelfish'), 'angelfish');
  assert.equal(animalAsset('bird', 'English budgie'), 'budgie');
  assert.equal(animalAsset('bird', 'canary'), 'canary');
  for (const variant of ['angelfish', 'budgie', 'canary'] as const) {
    assert.ok(candidateModelUrl(variant).includes('/' + variant + '.glb'));
    assert.ok(candidateDisplayName(variant).length > 2);
    assert.equal(candidateIsApproved(variant), false);
  }
});

test('existing calico candidate path remains stable', () => {
  assert.equal(candidateModelUrl('cat'), '/models/candidates/nuzzle-calico-rig.glb');
});
