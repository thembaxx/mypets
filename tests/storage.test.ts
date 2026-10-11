import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseData } from '../lib/storage';
import { demoPets, defaultEvents } from '../lib/care';
import { createDemoData } from '../lib/history';
test('damaged or unsupported saved state cannot crash the app', () => {
  for (const value of [
    'not-json',
    'null',
    '{}',
    JSON.stringify({ version: 1, pets: [{ id: 'bad' }], events: [] }),
  ])
    assert.equal(parseData(value), null);
});
test('already seeded demos gain history only for new companions and never duplicate it', () => {
  const full = createDemoData(new Date(2026, 9, 11, 12));
  const previousIds = new Set(demoPets.slice(0, 10).map((pet) => pet.id));
  const old = {
    ...full,
    pets: full.pets.filter((pet) => previousIds.has(pet.id)),
    events: full.events.filter((event) => previousIds.has(event.petId)),
    history: full.history?.filter((entry) => previousIds.has(entry.petId)),
    completed: full.completed.filter((key) =>
      full.events.some((event) => previousIds.has(event.petId) && key.endsWith(':' + event.id)),
    ),
    trained: full.trained.filter((key) => previousIds.has(key.split(':')[0])),
  };
  old.events[0] = { ...old.events[0], title: 'My saved breakfast time', time: '08:45' };
  const expanded = parseData(JSON.stringify(old))!;
  assert.equal(expanded.pets.length, 17);
  assert.equal(expanded.events[0].title, 'My saved breakfast time');
  assert.equal(expanded.events[0].time, '08:45');
  assert.deepEqual(
    expanded.history?.filter((entry) => previousIds.has(entry.petId)),
    old.history,
  );
  assert.deepEqual(
    expanded.completed.filter((key) => old.completed.includes(key)),
    old.completed,
  );
  for (const pet of expanded.pets.filter((pet) => !previousIds.has(pet.id))) {
    assert.equal(
      expanded.history?.filter((entry) => entry.petId === pet.id && entry.kind === 'practice')
        .length,
      10,
    );
    assert.ok(expanded.history?.some((entry) => entry.petId === pet.id && entry.kind === 'note'));
  }
  assert.deepEqual(parseData(JSON.stringify(expanded)), expanded);
  const personal = parseData(JSON.stringify({ ...old, demoMode: false }))!;
  assert.equal(personal.pets.length, old.pets.length);
  assert.deepEqual(personal.history, old.history);
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
