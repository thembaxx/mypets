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
  assert.equal(result?.events.length, demoPets.flatMap(defaultEvents).length);
});
test('sample collections expand once without replacing saved routines or real pets', () => {
  const original = demoPets.slice(0, 3);
  const custom = { ...defaultEvents(original[0])[0], id: 'custom', title: 'My own meal time' };
  const raw = {
    version: 1,
    pets: original,
    events: [custom],
    activePetId: 'cleo',
    completed: ['done'],
    demoMode: true,
    appearance: 'dark',
  };
  const expanded = parseData(JSON.stringify(raw));
  assert.equal(expanded?.pets.length, demoPets.length);
  assert.equal(expanded?.events[0].title, 'My own meal time');
  assert.equal(expanded?.appearance, 'dark');
  assert.equal(expanded?.activePetId, 'cleo');
  assert.deepEqual(parseData(JSON.stringify(expanded)), expanded);
  const personal = parseData(JSON.stringify({ ...raw, demoMode: false, appearance: 'invalid' }));
  assert.equal(personal?.pets.length, 3);
  assert.equal(personal?.events.length, 1);
  assert.equal(personal?.appearance, 'system');
});
