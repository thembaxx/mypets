import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPetCameraDistance } from '../lib/pet-camera';

test('portrait framing backs the camera away enough to contain the full pet width', () => {
  const portrait = fitPetCameraDistance(390, 844, 39);
  const landscape = fitPetCameraDistance(844, 390, 39);
  assert.ok(Number.isFinite(portrait));
  assert.ok(portrait > landscape);
});

test('wide and tall viewports retain the requested safety margin', () => {
  const distance = fitPetCameraDistance(390, 844, 39);
  const verticalHalfFov = (39 * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * (390 / 844),
  );
  assert.ok(distance * Math.tan(verticalHalfFov) >= 1.75 * 1.18);
  assert.ok(distance * Math.tan(horizontalHalfFov) >= 1.65 * 1.18);
});

test('invalid viewport dimensions and FOV values remain finite', () => {
  assert.ok(Number.isFinite(fitPetCameraDistance(Number.NaN, 0, Number.NaN)));
  assert.ok(fitPetCameraDistance(1, 1, 39) > 0);
});
