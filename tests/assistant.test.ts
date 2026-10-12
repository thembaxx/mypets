import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  classifyQuestion,
  historySummary,
  parseReminder,
  prepareReply,
  validateGeneratedReply,
  generationMessages,
} from '../lib/assistant';
import { parseConversation } from '../lib/assistant-storage';
import { calendarExport, dateKey, eventsForDate, demoPets, type CareEvent } from '../lib/care';
import { createDemoData } from '../lib/history';
import { parseData } from '../lib/storage';

const now = new Date(2026, 9, 12, 12);
const data = createDemoData(now);
const milo = data.pets.find((pet) => pet.id === 'milo')!;
const cleo = data.pets.find((pet) => pet.id === 'cleo')!;

test('reminder drafts preserve requested pet, local time and weekly days without saving', () => {
  const count = data.events.length;
  const draft = parseReminder(
    'Remind me to brush Cleo every Sunday at 6 pm for 10 minutes',
    data,
    milo,
    now,
  )!;
  assert.equal(draft.event.petId, cleo.id);
  assert.equal(draft.event.repeat, 'weekly');
  assert.deepEqual(draft.event.weekdays, [0]);
  assert.equal(draft.event.time, '18:00');
  assert.equal(draft.event.duration, 10);
  assert.equal(draft.event.title, 'Brush Cleo');
  assert.equal(data.events.length, count);
  assert.equal(eventsForDate([draft.event], cleo.id, '2026-10-18').length, 1);
  assert.equal(eventsForDate([draft.event], cleo.id, '2026-10-19').length, 0);
  assert.equal(eventsForDate([draft.event], milo.id, '2026-10-18').length, 0);
  const ics = calendarExport([draft.event], cleo, now);
  assert.match(ics, /DTSTART:20261018T180000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SU/);
  assert.match(ics, /BEGIN:VALARM/);
});

test('daily and once drafts are explicit about defaults and reject invalid input', () => {
  const daily = parseReminder(
    'Remind me to refresh water every morning at 7:30 am',
    data,
    milo,
    now,
  )!;
  assert.equal(daily.event.repeat, 'daily');
  assert.equal(daily.event.time, '07:30');
  assert.equal(daily.event.duration, 15);
  assert.ok(daily.assumptions.some((note) => note.includes('15 minutes')));
  const once = parseReminder('Remind me to check the carrier tomorrow at 12 pm', data, cleo, now)!;
  assert.equal(once.event.date, '2026-10-13');
  assert.equal(once.event.time, '12:00');
  for (const question of [
    'Remind me to brush every month',
    'Remind me to brush on 2026-02-30',
    'Remind me to brush at 25:00',
    'Remind me to brush at 13 pm',
    'Remind me to brush for 0 minutes',
  ])
    assert.equal(parseReminder(question, data, milo, now), null, question);
});

test('weekly routines survive storage and reject invalid weekdays and dates', () => {
  const event: CareEvent = {
    id: 'weekly',
    petId: milo.id,
    title: 'Brush',
    time: '09:00',
    duration: 15,
    kind: 'reminder',
    note: '',
    repeat: 'weekly',
    weekdays: [1, 3, 5],
  };
  const saved = { ...data, demoMode: false, events: [event] };
  assert.deepEqual(parseData(JSON.stringify(saved))?.events, [event]);
  assert.equal(eventsForDate([event], milo.id, '2026-10-12').length, 1);
  assert.equal(eventsForDate([event], milo.id, '2026-10-13').length, 0);
  assert.equal(eventsForDate([event], milo.id, '2026-02-30').length, 0);
  for (const weekdays of [[], [7], [-1], [1.5]])
    assert.equal(parseData(JSON.stringify({ ...saved, events: [{ ...event, weekdays }] })), null);
});

test('history totals isolate pets, deduplicate care, exclude future records, and label samples', () => {
  const event = data.events.find((item) => item.petId === milo.id)!;
  const history = historySummary(
    {
      ...data,
      completed: [
        dateKey(now) + ':' + event.id,
        dateKey(now) + ':' + event.id,
        '2026-10-13:' + event.id,
      ],
      history: [],
    },
    milo,
    now,
  );
  assert.equal(history.completed, 1);
  assert.equal(history.activeDays, 1);
  assert.match(history.text, /seeded sample records/);
  const empty = historySummary({ ...data, demoMode: false, completed: [], history: [] }, milo, now);
  assert.equal(empty.completed, 0);
  assert.match(empty.text, /Unlogged activity is not counted/);
  assert.equal(
    historySummary({ ...data, completed: [dateKey(now) + ':' + event.id], history: [] }, cleo, now)
      .completed,
    0,
  );
});

test('medical and nutrition answers bypass generation rather than inventing treatment or portions', () => {
  assert.match(prepareReply('My pet cannot breathe', data, milo, now).reply.text, /emergency vet/);
  for (const question of [
    'My rabbit stopped eating',
    'What ibuprofen dose should I give?',
    'Milo is vomiting',
    'My pet cannot breathe',
  ]) {
    assert.equal(classifyQuestion(question), 'health');
    const result = prepareReply(question, data, milo, now);
    assert.equal(result.canGenerate, false);
    assert.match(result.reply.text, /vet/);
  }
  const food = prepareReply('How much food should Milo eat?', data, milo, now);
  assert.equal(food.canGenerate, false);
  assert.match(food.reply.text, /food label/);
  for (const species of ['snake', 'salamander', 'gecko'] as const) {
    const pet = demoPets.find((item) => item.species === species)!;
    const reply = prepareReply('What diet is recommended?', data, pet, now);
    assert.equal(reply.canGenerate, false);
    assert.ok(reply.reply.sources[0].href?.startsWith('https://'));
  }
});

test('generated explanations cannot invent citations, URLs or new numbers', () => {
  const prepared = prepareReply('Help me practise sit', data, milo, now);
  assert.equal(prepared.canGenerate, true);
  const good = validateGeneratedReply(
    JSON.stringify({
      answer:
        'Reward Milo when his bottom reaches the floor. Keep practice kind and let him relax afterwards.',
      citations: ['lesson-sit'],
    }),
    prepared,
  );
  assert.equal(good?.mode, 'llama');
  assert.ok(good?.sources[0].href?.includes('pdsa.org.uk'));
  for (const value of [
    { answer: 'Reward with a kind word.', citations: ['invented-source'] },
    { answer: 'See https://untrusted.example for a new plan.', citations: ['lesson-sit'] },
    { answer: 'Practise for 99 minutes.', citations: ['lesson-sit'] },
    { answer: 'Punish the dog when he is distracted.', citations: ['lesson-sit'] },
    { answer: 'Give the dog some medication.', citations: ['lesson-sit'] },
  ])
    assert.equal(validateGeneratedReply(JSON.stringify(value), prepared), null);
  const messages = generationMessages('Help me practise sit', prepared);
  assert.equal(
    messages.some((message) => message.content.includes(cleo.breed)),
    false,
  );
  assert.equal(
    messages.some((message) => message.content.includes('photo')),
    false,
  );
});

test('conversation restoration rejects other pets and untrusted source links', () => {
  const message = {
    id: 'one',
    petId: milo.id,
    role: 'assistant',
    text: 'A saved note.',
    createdAt: now.toISOString(),
  };
  assert.equal(parseConversation([message, { ...message, petId: cleo.id }], milo.id).length, 1);
  assert.deepEqual(
    parseConversation(
      [
        {
          ...message,
          sources: [{ id: 'bad', title: 'Source', text: 'Text', href: 'javascript:alert(1)' }],
        },
      ],
      milo.id,
    ),
    [],
  );
  assert.equal(
    parseConversation(
      Array.from({ length: 60 }, (_, index) => ({ ...message, id: String(index) })),
      milo.id,
    ).length,
    40,
  );
});
