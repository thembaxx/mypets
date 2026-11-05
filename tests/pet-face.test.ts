import assert from 'node:assert/strict';
import test from 'node:test';
import { catActivities, catMoods } from '../lib/cat-motion';
import { petBlinkAt, petFacialMorphTarget } from '../lib/pet-face';

test('eye blinks close and reopen smoothly instead of snapping', () => {
  assert.equal(petBlinkAt(0), 0);
  assert.ok(petBlinkAt(0.12) > 0.95);
  assert.equal(petBlinkAt(0.26), 0);
  assert.ok(petBlinkAt(4.7 + 0.4) > 0);
});

test('natural expression curves stay finite and bounded for every activity', () => {
  const names = [
    'Eye_Blink',
    'JawOpen',
    'TongueOut',
    'NoseFlare',
    'WhiskerForward',
    'CheekPuff',
    'EyeWide',
    'Smile',
    'EarBack',
  ];
  for (const activity of catActivities) {
    for (const mood of catMoods) {
      for (let time = 0; time < 12; time += 0.13) {
        for (const name of names) {
          const value = petFacialMorphTarget(name, activity, mood, time);
          assert.ok(value !== null && Number.isFinite(value));
          assert.ok(value >= 0 && value <= 1, name + ': ' + value);
        }
      }
    }
  }
});

test('feeding actuates real jaw and tongue morphs while curiosity opens eyes', () => {
  assert.ok(petFacialMorphTarget('JawOpen', 'eat', 'happy', 0.15)! > 0.1);
  assert.ok(petFacialMorphTarget('TongueOut', 'groom', 'happy', 0.15)! > 0);
  assert.ok(petFacialMorphTarget('EyeWide', 'idle', 'curious', 1)! > 0.8);
  assert.ok(petFacialMorphTarget('EyeBlink', 'rest', 'sleepy', 1)! >= 0.9);
});

test('non-facial and unknown rig channels remain entirely untouched', () => {
  for (const name of ['LegIK', 'BodyWeight', 'WheelSpin', 'RootMotion']) {
    assert.equal(petFacialMorphTarget(name, 'play', 'happy', 1), null);
  }
});
