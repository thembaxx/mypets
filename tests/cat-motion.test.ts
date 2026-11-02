import assert from 'node:assert/strict';
import test from 'node:test';
import {
  catActivities,
  catMoods,
  catPoseAt,
  clamp,
} from '../lib/cat-motion';

test('poses remain finite and feet never penetrate the simple ground plane', () => {
  for (const activity of catActivities)
    for (const mood of catMoods)
      for (let t = 0; t < 30; t += 0.17) {
        const pose = catPoseAt(activity, mood, t);
        for (const value of Object.values(pose)) {
          const numbers = Array.isArray(value) ? value : [value];
          for (const n of numbers) assert.ok(Number.isFinite(n), activity + ': ' + n);
        }
        assert.ok(pose.pawLift[0] >= 0);
        assert.ok(pose.pawLift[1] >= 0);
        assert.ok(Math.abs(pose.x) <= 0.651);
      }
});

test('feeding actually flexes the jaw, lowers the head and animates the tongue', () => {
  const poses = Array.from({ length: 80 }, (_, i) => catPoseAt('eat', 'happy', i / 30));
  assert.ok(poses.every((pose) => pose.headDrop > 0.4));
  assert.ok(Math.max(...poses.map((pose) => pose.jaw)) > 0.3);
  assert.ok(Math.max(...poses.map((pose) => pose.tongue)) > 0.18);
  assert.ok(Math.min(...poses.map((pose) => pose.tongue)) === 0);
});

test('four-limbed walking uses opposite phases, turning and real x motion', () => {
  const a = catPoseAt('walk', 'curious', 0.2);
  const b = catPoseAt('walk', 'curious', 0.8);
  assert.ok(a.frontPaws[0] * a.frontPaws[1] < 0);
  assert.ok(a.backPaws[0] * a.frontPaws[0] < 0);
  assert.notEqual(a.x, b.x);
  assert.ok(a.pawLift[0] > 0 || a.pawLift[1] > 0);
});

test('faces change on mood and natural blink repeats deterministically', () => {
  assert.ok(catPoseAt('idle', 'curious', 1).eyeOpen > catPoseAt('idle', 'happy', 1).eyeOpen);
  assert.ok(catPoseAt('idle', 'sleepy', 2).blink >= 0.65);
  assert.deepEqual(catPoseAt('eat', 'happy', 3.5), catPoseAt('eat', 'happy', 3.5));
  assert.equal(clamp(2, 0, 1), 1);
});
