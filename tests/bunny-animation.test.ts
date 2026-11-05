import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnimationClip, Group, Mesh, MeshBasicMaterial,
  SphereGeometry, VectorKeyframeTrack,
} from 'three';
import {
  BunnyAnimationController, BUNNY_ACTIONS, REQUIRED_BUNNY_MORPHS,
} from '../lib/bunny/animation-controller';

function fixture() {
  const root = new Group();
  const face = new Mesh(new SphereGeometry(1, 8, 6), new MeshBasicMaterial());
  face.name = 'BunnyFace';
  face.morphTargetDictionary = Object.fromEntries(
    REQUIRED_BUNNY_MORPHS.map((name, i) => [name, i]),
  );
  face.morphTargetInfluences = Array(REQUIRED_BUNNY_MORPHS.length).fill(0);
  root.add(face);
  const clips = BUNNY_ACTIONS.map((name) => new AnimationClip(name, 0.45, [
    new VectorKeyframeTrack('.position', [0, 0.45], [0, 0, 0, 0, 0.015, 0]),
  ]));
  return { root, face, clips };
}

test('requires all ten authentic named clips', () => {
  const { root, clips } = fixture();
  assert.throws(() => new BunnyAnimationController(root, clips.slice(0, 9)), /PetReaction/);
});

test('requires all facial morph names', () => {
  const { root, face, clips } = fixture();
  delete face.morphTargetDictionary?.noseScrunch;
  assert.throws(() => new BunnyAnimationController(root, clips), /noseScrunch/);
});

test('blends happiness into independently addressable morph targets', () => {
  const { root, face, clips } = fixture();
  const controller = new BunnyAnimationController(root, clips);
  controller.play('Idle');
  controller.express('happy');
  for (let i = 0; i < 10; i++) controller.update(0.05);
  const blink = face.morphTargetDictionary?.eyeBlink_L;
  const smile = face.morphTargetDictionary?.mouthSmile;
  const frown = face.morphTargetDictionary?.mouthFrown;
  assert.ok(face.morphTargetInfluences![blink!] > 0.7);
  assert.ok(face.morphTargetInfluences![smile!] > 0.7);
  assert.equal(face.morphTargetInfluences![frown!], 0);
  controller.dispose();
});

test('sleep queues LieDown, then enters the authored Sleep clip', () => {
  const { root, clips } = fixture();
  const controller = new BunnyAnimationController(root, clips);
  controller.play('Idle');
  controller.play('Sleep');
  assert.equal(controller.currentAction, 'LieDown');
  for (let i = 0; i < 15; i++) controller.update(0.05);
  assert.equal(controller.currentAction, 'Sleep');
  controller.dispose();
});

test('disabled animations remain frozen', () => {
  const { root, clips } = fixture();
  const controller = new BunnyAnimationController(root, clips);
  controller.play('Walk');
  controller.setEnabled(false);
  controller.update(1);
  assert.equal(root.position.y, 0);
  controller.dispose();
});
