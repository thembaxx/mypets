import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import test from 'node:test';

test('phone GLB viewer compiles and supports original plus animated models without a CDN', () => {
  const viewer = readFileSync(new URL('../public/3d-viewer.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../public/3d-preview.html', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Script(viewer));
  assert.match(page, /data-model-stem="mypets-paw-charm"/);
  assert.match(page, /<script src="\/3d-viewer\.js" defer>/);
  for (const feature of ['gl.drawElements', 'gl.drawArrays', 'nodeMatrix', 'updatePose', 'requestAnimationFrame', 'pointermove', 'ResizeObserver', 'toBlob', 'prefers-reduced-motion']) assert.ok(viewer.includes(feature), feature);
  assert.doesNotMatch(viewer, /https?:\/\//);
});

test('service worker precaches the static and animated local models plus the viewer', () => {
  const pwa = readFileSync(new URL('../scripts/prepare-pwa.mjs', import.meta.url), 'utf8');
  for (const asset of ['3d-preview.html', '3d-viewer.js', 'mypets-paw-charm-animated.glb', 'mypets-paw-charm.glb']) {
    assert.ok(pwa.includes(asset), asset);
  }
});
