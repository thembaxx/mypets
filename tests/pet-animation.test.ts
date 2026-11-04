import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip, NumberKeyframeTrack, Object3D } from 'three';
import {
  fitPetCamera,
  normalizeAnimationName,
  PetAnimationController,
  resolvePetAnimation,
  resolvePetClip,
} from '../lib/pet-animation';

const clip = (name: string, duration = 1) =>
  new AnimationClip(name, duration, [
    new NumberKeyframeTrack('.position[x]', [0, duration], [0, 1]),
  ]);

test('normalizes imported names without confusing distinct biological actions', () => {
  assert.equal(normalizeAnimationName('Armature|Cat_Idle.001'), 'cat idle');
  assert.equal(normalizeAnimationName('rig:TailWag'), 'tail wag');
  assert.equal(resolvePetClip(['Armature|Cat_Idle.001'], 'idle'), 'Armature|Cat_Idle.001');
  assert.equal(resolvePetClip(['TailWag'], 'move'), null);
  assert.equal(resolvePetClip(['ReactToTouch'], 'touch'), 'ReactToTouch');
  assert.equal(resolvePetClip(['standalone material', 'eaten'], 'eat'), null);
});

test('asset aliases are exact and authoritative, and unknown activities fall back truthfully', () => {
  const aliases = { idle: ['Take_001'], eat: ['Eating'], play: [] };
  const names = ['Take 001', 'Eat', 'Playing'];
  assert.equal(resolvePetClip(names, 'idle', aliases), 'Take 001');
  assert.equal(resolvePetClip(names, 'eat', aliases), null);
  assert.equal(resolvePetClip(names, 'play', aliases), null);
  assert.deepEqual(resolvePetAnimation(names, 'eat', aliases), {
    requested: 'eat',
    clip: 'Take 001',
    fallback: true,
  });
  assert.deepEqual(resolvePetAnimation(['Wag'], 'idle'), {
    requested: 'idle',
    clip: null,
    fallback: false,
  });
  assert.deepEqual(resolvePetAnimation([], 'eat'), {
    requested: 'eat',
    clip: null,
    fallback: true,
  });
});

test('controller pauses exactly, resumes, retires crossfades and disposes mixer bindings', () => {
  const model = new Object3D();
  const animations = [clip('Idle'), clip('Walk'), clip('Eat')];
  const controller = new PetAnimationController(model, animations);
  controller.setActivity('idle');
  controller.update(0.05);
  const firstPose = model.position.x;
  assert.ok(firstPose > 0);
  controller.setEnabled(false);
  for (let n = 0; n < 30; n++) controller.update(0.05);
  assert.equal(model.position.x, firstPose);
  controller.setEnabled(true);
  controller.update(0.05);
  assert.ok(model.position.x > firstPose);
  controller.setActivity('move');
  assert.equal(controller.currentClip, 'Walk');
  for (let n = 0; n < 8; n++) controller.update(0.05);
  assert.equal(controller.mixer.existingAction(animations[0])?.isRunning(), false);
  assert.equal(controller.mixer.existingAction(animations[1])?.isRunning(), true);
  controller.setActivity('eat');
  controller.setActivity('idle');
  for (let n = 0; n < 8; n++) controller.update(0.05);
  assert.equal(controller.mixer.existingAction(animations[1])?.isRunning(), false);
  assert.equal(controller.mixer.existingAction(animations[2])?.isRunning(), false);
  controller.dispose();
  controller.dispose();
  assert.equal(controller.currentClip, null);
  assert.equal(controller.mixer.existingAction(animations[0]), null);
  const disposedPose = model.position.x;
  controller.update(0.05);
  assert.equal(model.position.x, disposedPose);
});

test('touch is a genuine one-shot and returns to supported idle only', () => {
  const controller = new PetAnimationController(new Object3D(), [clip('Idle'), clip('React', 0.1)]);
  controller.setActivity('touch');
  assert.equal(controller.currentClip, 'React');
  controller.update(0.05);
  controller.update(0.05);
  controller.update(0.05);
  assert.equal(controller.currentClip, 'Idle');
  controller.dispose();
});

test('static and unsupported models do not play an arbitrary first clip', () => {
  const controller = new PetAnimationController(new Object3D(), [clip('Take 7')]);
  assert.equal(controller.setActivity('play').clip, null);
  assert.equal(controller.currentClip, null);
  controller.update(0.05);
  controller.dispose();
});

test('camera fits the complete sphere in portrait and landscape at any orbit angle', () => {
  for (const aspect of [0.42, 0.67, 1, 1.8, 2.4]) {
    const radius = 1.7;
    const distance = fitPetCamera(radius, 39, aspect);
    const verticalHalf = (39 * Math.PI) / 360;
    const horizontalHalf = Math.atan(Math.tan(verticalHalf) * aspect);
    assert.ok(distance * Math.sin(verticalHalf) >= radius * 1.15 - 1e-9);
    assert.ok(distance * Math.sin(horizontalHalf) >= radius * 1.15 - 1e-9);
  }
  assert.ok(fitPetCamera(1, 39, 0.5) > fitPetCamera(1, 39, 2));
  assert.ok(Number.isFinite(fitPetCamera(Number.NaN, Number.NaN, 0)));
});
