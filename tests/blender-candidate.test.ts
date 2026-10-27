import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('cloud Blender authoring is opt-in and review-only', () => {
  const script = readFileSync(new URL('../scripts/author-blender-candidate.py', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../.github/workflows/blender-candidate.yml', import.meta.url), 'utf8');
  assert.match(script, /def paw_scene\(\)/);
  assert.match(script, /export_format="GLB"/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /validate-3d-assets/);
  assert.doesNotMatch(workflow, /push:\s*|schedule:\s*/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test('candidate review stays on-device and checks GLB bounds', () => {
  const script = readFileSync(new URL('../public/3d-viewer.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/3d-preview.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="candidate"'));
  assert.ok(script.includes('candidateInput.files?.[0]'));
  assert.ok(script.includes('file.arrayBuffer()'));
  assert.ok(script.includes('file.size>MAX_FILE'));
  assert.ok(!script.includes('FormData('));
});
