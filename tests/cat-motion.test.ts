import assert from 'node:assert/strict';
import test from 'node:test';
import { catActivities, catMoods, catPoseAt, catTailTipAt, clamp } from '../lib/cat-motion';

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

test('grooming lifts one forepaw and actuates the tongue while sniffing varies the face', () => {
  const groom = Array.from({ length: 50 }, (_, i) => catPoseAt('groom', 'happy', i / 20));
  assert.ok(groom.some((pose) => pose.pawLift[0] > 0.34));
  assert.ok(groom.some((pose) => pose.tongue > 0.13));
  assert.ok(groom.some((pose) => Math.abs(pose.headYaw) > 0.22));
  const sniff = Array.from({ length: 50 }, (_, i) => catPoseAt('sniff', 'curious', i / 20));
  assert.ok(sniff.some((pose) => pose.eyeOpen > 0.7));
  assert.ok(sniff.some((pose) => Math.abs(pose.earTilt) > 0.08));
  assert.ok(sniff.some((pose) => Math.abs(pose.headYaw) > 0.16));
});

test('secondary tail gesture is smooth, bounded, and nearly still when resting', () => {
  for (const activity of catActivities)
    for (const mood of catMoods) {
      let previous = catTailTipAt(activity, mood, 0);
      for (let i = 1; i <= 900; i++) {
        const current = catTailTipAt(activity, mood, i / 60);
        assert.ok(Number.isFinite(current));
        assert.ok(current >= -0.8 && current <= -0.18);
        assert.ok(Math.abs(current - previous) < 0.04, activity);
        previous = current;
      }
    }
  assert.ok(Math.abs(catTailTipAt('rest', 'sleepy', 2) + 0.48) < 0.02);
  assert.equal(catTailTipAt('idle', 'curious', Number.NaN), catTailTipAt('idle', 'curious', 0));
});
