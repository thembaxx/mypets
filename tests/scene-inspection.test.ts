import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import {
  createSceneInspectionController,
  sceneTimelineProgress,
} from '../lib/scene-inspection';

test('scene inspection separates authored parts deterministically and restores transforms', () => {
  const root = new Group();
  const left = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  const right = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  left.position.x = -1;
  right.position.x = 1;
  root.add(left, right);
  const original = [left.position.clone(), right.position.clone()];
  const inspection = createSceneInspectionController(root, { gap: 0.2 });

  inspection.setProgress(0);
  assert.deepEqual(left.position, original[0]);
  assert.deepEqual(right.position, original[1]);
  inspection.setProgress(0.5);
  assert.ok(left.position.distanceTo(original[0]) > 0);
  assert.ok(right.position.distanceTo(original[1]) > 0);
  inspection.setProgress(1);
  const separated = [left.position.clone(), right.position.clone()];
  inspection.setProgress(1);
  assert.deepEqual(left.position, separated[0]);
  assert.deepEqual(right.position, separated[1]);
  inspection.dispose();
  assert.deepEqual(left.position, original[0]);
  assert.deepEqual(right.position, original[1]);
});

test('timeline progress is clamped and handles invalid durations', () => {
  assert.equal(sceneTimelineProgress(250, 1000), 0.25);
  assert.equal(sceneTimelineProgress(-10, 1000), 0);
  assert.equal(sceneTimelineProgress(1200, 1000), 1);
  assert.equal(sceneTimelineProgress(0, 0), 1);
  assert.equal(sceneTimelineProgress(Number.NaN, 1000), 0);
});
