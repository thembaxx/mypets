import assert from 'node:assert/strict';
import test from 'node:test';
import { hapticPattern, requestHaptic } from '../lib/haptic-feedback';

test('tactile feedback is short and intentional', () => {
  assert.equal(hapticPattern('select'), 12);
  assert.deepEqual(hapticPattern('confirm'), [12, 24, 18]);
});

test('server rendering never requests vibration', () => {
  assert.equal(requestHaptic(), false);
});
