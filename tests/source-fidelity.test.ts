import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const source = (relative: string) =>
  readFileSync(new URL('../' + relative, import.meta.url), 'utf8');

test('all original animals stay source-of-truth during optional 3D preview', () => {
  const originals = readdirSync(new URL('../assets/animal-originals/', import.meta.url)).filter(
    (file) => file.endsWith('.jpg'),
  );
  const illustrations = readdirSync(new URL('../public/animals/', import.meta.url)).filter((file) =>
    file.endsWith('.webp'),
  );
  assert.equal(originals.length, 17);
  for (const file of originals) {
    assert.ok(illustrations.includes(file.replace(/\.jpg$/, '.webp')), file);
  }
  const approved = source('lib/tripo-models.ts');
  assert.match(approved, /approvedTripoModels[^\n]*= \{\}/);
});
test('3D studio provides source comparison and does not fabricate 3D animations', () => {
  const studio = source('components/tripo-pet.tsx');
  for (const feature of [
    'Compare with original',
    'Original reference',
    'Reset front view',
    'referenceImageUrl',
    'motionBlocked',
    'useContext(AnimalAnimationContext)',
  ]) {
    assert.ok(studio.includes(feature), feature);
  }
  assert.match(studio, /findPetClip\(report\.clips, 'play'\)/);
});
test('settings preference is persisted and reused in standalone 3D lab', () => {
  const app = source('components/pet-app.tsx');
  const lab = source('app/3d-lab/page.tsx');
  const data = source('lib/storage.ts');
  assert.match(app, /Animal animations · 2D and 3D/);
  assert.match(app, /animalAnimations: previous\.animalAnimations === false/);
  assert.match(lab, /readData\(\)\?\.animalAnimations !== false/);
  assert.match(lab, /AnimalAnimationContext\.Provider value=\{animationEnabled\}/);
  assert.match(data, /animalAnimations: data\.animalAnimations !== false/);
});
test('high-detail Blender source reconstruction requires human approval', () => {
  const intake = source('scripts/import-image3d-blender.py');
  const batch = source('scripts/batch-image3d-blender.py');
  const validator = source('lib/validate-local-glb.ts');
  assert.match(intake, /render_fidelity_views/);
  assert.match(intake, /likeness_approved.*False/);
  assert.match(batch, /MISSING_GENERATED_GLB/);
  assert.match(batch, /READY_FOR_HUMAN_FIDELITY_REVIEW/);
  assert.doesNotMatch(validator, /8 \* 1024 \* 1024|160000/);
});

test('opt-in cat dog rabbit previews prioritize source-style chibi rigs', () => {
  const shared = source('components/shared.tsx');
  assert.match(shared, /chibiCandidateModelUrl\(asset as AnimalCandidateId\)/);
  assert.match(shared, /candidateModelUrl\(asset as AnimalCandidateId\)/);
  assert.match(shared, /const experimentalModelUrl/);
  assert.match(shared, /candidateUrl=\{experimentalModelUrl\}/);
  const urls = source('lib/species-3d.ts');
  assert.match(urls, /id === 'cat' \|\| id === 'dog' \|\| id === 'rabbit'/);
});

test('mobile 3D viewing keeps the entire animated character in frame', () => {
  const viewer = source('components/tripo-pet.tsx');
  assert.match(viewer, /size\.width <= 520 \|\| size\.height <= 450/);
  assert.match(viewer, /const distance = compact \? 6\.1 : 4\.8/);
  assert.match(viewer, /const targetY = compact \? 1\.2 : 0\.91/);
  assert.match(viewer, /controls\.target\.set\(0, targetY, 0\)/);
  assert.match(viewer, /frameloop=\{reduced \? 'demand' : 'always'\}/);
});

test('mobile 3D header never overlays the original character or controls', () => {
  const css = source('app/living-cat.css');
  assert.match(css, /\.tripo-living-dialog > \.tripo-heading/);
  assert.match(css, /position: relative;/);
  assert.match(css, /flex: 0 0 auto;/);
  assert.match(css, /z-index: 5;/);
});
