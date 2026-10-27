import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyReviewPack } from './check-blender-review.mjs';
test('only named candidate presets can be checked', () => {
  assert.throws(() => verifyReviewPack('/tmp', 'other'), /Unsupported preset/);
});
test('missing or non-GLB review assets fail before upload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blender-'));
  try {
    assert.throws(() => verifyReviewPack(dir, 'paw'), /ENOENT/);
    writeFileSync(join(dir, 'mypets-paw-blender-candidate.blend'), Buffer.alloc(160, 1));
    writeFileSync(join(dir, 'mypets-paw-blender-candidate.glb'), Buffer.alloc(64, 1));
    assert.throws(() => verifyReviewPack(dir, 'paw'), /Invalid GLB header/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
