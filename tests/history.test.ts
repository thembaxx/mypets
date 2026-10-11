import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createDemoData, seedDemoHistory, careCount } from '../lib/history';
import { parseData } from '../lib/storage';
import { dateKey, eventsForDate, lessonsFor } from '../lib/care';
const now = new Date(2026, 9, 11, 12);
test('demo has thirty past days of species-specific care and practice with no future completions', () => {
  const data = createDemoData(now);
  for (const pet of data.pets) {
    const days = new Set(
      data.completed
        .filter((key) =>
          data.events.some((event) => event.petId === pet.id && key.endsWith(':' + event.id)),
        )
        .map((key) => key.slice(0, 10)),
    );
    assert.equal(days.size, 30);
    assert.ok([...days].every((day) => day < dateKey(now)));
    assert.equal(days.has('2026-09-11'), true);
    assert.equal(days.has('2026-10-10'), true);
    const practices =
      data.history?.filter((entry) => entry.petId === pet.id && entry.kind === 'practice') ?? [];
    assert.equal(practices.length, 10);
    assert.ok(
      practices.every((entry) => lessonsFor(pet).some((lesson) => lesson.id === entry.lessonId)),
    );
    for (const day of days) {
      const scheduled = eventsForDate(data.events, pet.id, day);
      assert.ok(careCount(data, pet.id, day) <= scheduled.length);
    }
  }
  assert.ok(
    data.history?.some(
      (entry) => entry.petId === 'bubbles' && /aquarium|water|feeding/.test(entry.note),
    ),
  );
  assert.ok(
    data.history?.some(
      (entry) => entry.petId === 'hazel' && /evening|daytime|woke/.test(entry.note),
    ),
  );
  assert.deepEqual(seedDemoHistory(data, new Date(2027, 0, 1)), data);
});
test('seed migration preserves custom events, saved progress, notes, and all personal collections', () => {
  const data = createDemoData(now);
  const custom = { ...data.events[0], id: 'my-custom', title: 'My routine' };
  const note = {
    id: 'personal-note',
    petId: 'milo',
    date: '2026-10-09',
    kind: 'note' as const,
    title: 'My note',
    note: 'A favourite moment.',
  };
  const old = {
    ...data,
    demoSeedVersion: undefined,
    events: [custom],
    completed: ['2026-10-10:my-custom'],
    trained: ['milo:personal'],
    history: [note],
  };
  const migrated = seedDemoHistory(old, now);
  assert.equal(migrated.events[0], custom);
  assert.ok(migrated.completed.includes('2026-10-10:my-custom'));
  assert.ok(migrated.trained.includes('milo:personal'));
  assert.ok(migrated.history?.includes(note));
  assert.equal(new Set(migrated.completed).size, migrated.completed.length);
  const personal = { ...old, demoMode: false };
  assert.equal(seedDemoHistory(personal, now), personal);
  const parsed = parseData(JSON.stringify(personal));
  assert.deepEqual(parsed?.history, [note]);
  assert.equal(parsed?.events.length, 1);
  assert.deepEqual(parsed?.completed, personal.completed);
});
