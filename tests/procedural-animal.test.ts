import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createProceduralRabbit,
  disposeProceduralRabbit,
  setProceduralRabbitPose,
} from '../lib/procedural-animal';

test('procedural rabbit exposes independently named anatomical parts', () => {
  const rabbit = createProceduralRabbit();
  const names = new Set<string>();
  rabbit.traverse((node) => names.add(node.name));
  const expectedParts = [
    'rabbit-body',
    'rabbit-head',
    'ear-left',
    'ear-right',
    'hind-leg-left',
    'hind-leg-right',
    'fore-leg-left',
    'fore-leg-right',
    'eye-left',
    'eye-right',
    'nose',
  ];
  for (const name of expectedParts) {
    assert.ok(names.has(name), 'missing ' + name);
  }
  assert.equal(rabbit.userData.proceduralSource, 'threejs-code-native');
  disposeProceduralRabbit(rabbit);
});

test('pose sampling is deterministic and keeps generated transforms finite', () => {
  const rabbit = createProceduralRabbit();
  setProceduralRabbitPose(rabbit, 'hop', 0.25);
  const first = new THREE.Vector3();
  rabbit.getObjectByName('rabbit-body')?.getWorldPosition(first);
  setProceduralRabbitPose(rabbit, 'hop', 0.25);
  const second = new THREE.Vector3();
  rabbit.getObjectByName('rabbit-body')?.getWorldPosition(second);
  assert.ok(first.distanceTo(second) < 1e-8);
  for (const pose of [
    'idle',
    'walk',
    'hop',
    'sit',
    'lie',
    'sleep',
    'happy',
    'sad',
    'play',
    'pet',
  ] as const) {
    setProceduralRabbitPose(rabbit, pose, 1.25);
    rabbit.traverse((node) => {
      assert.ok(Number.isFinite(node.position.x + node.position.y + node.position.z));
      assert.ok(Number.isFinite(node.rotation.x + node.rotation.y + node.rotation.z));
    });
  }
  disposeProceduralRabbit(rabbit);
});

test('sleep closes the eyes, sit folds the hind legs, and walk alternates the gait', () => {
  const rabbit = createProceduralRabbit();
  const eye = rabbit.getObjectByName('eye-left') as THREE.Mesh;
  const hind = rabbit.getObjectByName('hind-leg-left') as THREE.Group;
  const fore = rabbit.getObjectByName('fore-leg-left') as THREE.Group;

  setProceduralRabbitPose(rabbit, 'sleep');
  assert.ok(eye.scale.y < 0.2);
  setProceduralRabbitPose(rabbit, 'idle');
  assert.equal(eye.scale.y, 1.05);
  setProceduralRabbitPose(rabbit, 'sit');
  assert.equal(hind.rotation.x, -0.55);
  setProceduralRabbitPose(rabbit, 'walk', 0.25);
  assert.ok(fore.rotation.x > 0);
  disposeProceduralRabbit(rabbit);
});
