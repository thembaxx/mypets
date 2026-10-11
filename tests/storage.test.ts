import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseData } from '../lib/storage';
import { demoPets, defaultEvents } from '../lib/care';
test('damaged or unsupported saved state cannot crash the app', () => {
  for (const value of [
    'not-json',
    'null',
    '{}',
    JSON.stringify({ version: 1, pets: [{ id: 'bad' }], events: [] }),
  ])
    assert.equal(parseData(value), null);
});
test('valid profiles recover a missing selection and preserve events', () => {
  const result = parseData(
    JSON.stringify({
      version: 1,
      pets: demoPets,
      events: demoPets.flatMap(defaultEvents),
      activePetId: 'removed',
      onboarded: true,
      completed: ['2026-10-11:milo-breakfast', 3],
    }),
  );
  assert.equal(result?.activePetId, 'milo');
  assert.deepEqual(result?.completed, ['2026-10-11:milo-breakfast']);
  assert.equal(result?.events.length, 18);
});
