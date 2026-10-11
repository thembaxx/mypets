import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  careGuide,
  defaultEvents,
  eventsForDate,
  calendarExport,
  factsFor,
  lessonsFor,
  lifeStage,
  demoPets,
  type Pet,
} from '../lib/care';
const dog: Pet = {
  id: 'test',
  name: 'Milo',
  species: 'dog',
  breed: 'Golden Retriever',
  ageMonths: 24,
};
test('young and senior plans adapt exercise, meals and learning', () => {
  const puppy = { ...dog, ageMonths: 4 };
  const senior = { ...dog, ageMonths: 100 };
  assert.equal(lifeStage(puppy), 'young');
  assert.equal(lifeStage(senior), 'senior');
  assert.equal(careGuide(puppy).meals, 3);
  assert.ok(careGuide(puppy).exercise < careGuide(dog).exercise);
  assert.ok(careGuide(senior).exercise < careGuide(dog).exercise);
  assert.ok(defaultEvents(puppy).some((e) => e.id === 'test-lunch'));
  assert.ok(lessonsFor(senior).some((l) => l.title === 'Gentle connection'));
});
test('additional pets get habitat and enrichment care without dog routines', () => {
  for (const pet of demoPets.slice(3)) {
    assert.ok(defaultEvents(pet).length >= 4);
    assert.ok(defaultEvents(pet).every((event) => event.kind !== 'walk'));
    assert.ok(factsFor(pet).every((fact) => fact.source.startsWith('https://www.rspca.org.uk/')));
    assert.ok(lessonsFor(pet).every((lesson) => !['sit', 'leash', 'recall'].includes(lesson.id)));
  }
  const hamster = demoPets.find((pet) => pet.species === 'hamster')!;
  assert.ok(
    defaultEvents(hamster)
      .filter((event) => event.kind === 'meal' || event.kind === 'play')
      .every((event) => event.time >= '19:00'),
  );
  assert.match(
    careGuide(demoPets.find((pet) => pet.species === 'guinea-pig')!).dietBody,
    /vitamin C/,
  );
  const fish = demoPets.find((pet) => pet.species === 'fish')!;
  assert.match(careGuide({ ...fish, breed: 'Unknown' }).dietBody, /Identify the fish species/);
  assert.match(careGuide({ ...fish, breed: 'Freshwater Angelfish' }).exerciseNote, /tropical/);
  const chicken = demoPets.find((pet) => pet.species === 'chicken')!;
  assert.match(careGuide(chicken).dietBody, /starter or grower/);
  assert.match(careGuide({ ...chicken, ageMonths: 18 }).dietBody, /laying status/);
});
test('breed affects the adult dog starting routine', () => {
  assert.ok(careGuide(dog).exercise > careGuide({ ...dog, breed: 'French Bulldog' }).exercise);
  assert.ok(careGuide({ ...dog, breed: 'Unknown' }).exercise > 0);
  assert.equal(
    factsFor({ ...dog, breed: 'Unknown' }).some((f) => f.id === 'golden'),
    false,
  );
});
test('species-specific care avoids dog walking for cats and rabbits', () => {
  for (const species of ['cat', 'rabbit'] as const) {
    const pet = { ...dog, species };
    assert.equal(
      defaultEvents(pet).some((e) => e.kind === 'walk'),
      false,
    );
    assert.ok(lessonsFor(pet).every((l) => !['sit', 'leash', 'recall'].includes(l.id)));
  }
  assert.match(careGuide({ ...dog, species: 'rabbit' }).dietBody, /all day/);
});
test('calendar separates pets, dates and daily recurrence', () => {
  const events = [
    ...defaultEvents(dog),
    {
      id: 'once',
      petId: 'test',
      title: 'Vet',
      time: '10:00',
      duration: 30,
      kind: 'reminder' as const,
      note: 'Bring records',
      repeat: 'once' as const,
      date: '2026-10-12',
    },
  ];
  assert.equal(eventsForDate(events, 'other', '2026-10-12').length, 0);
  assert.equal(eventsForDate(events, 'test', '2026-10-12').length, defaultEvents(dog).length + 1);
  assert.equal(eventsForDate(events, 'test', '2026-10-13').length, defaultEvents(dog).length);
});
test('calendar export escapes text, calculates end times and includes reminders', () => {
  const event = {
    ...defaultEvents(dog)[0],
    time: '23:45',
    duration: 30,
    title: 'Meal, water; calm',
    notify: true,
  };
  const ics = calendarExport([event], dog, new Date(2026, 9, 12));
  assert.match(ics, /DTSTART:20261012T234500/);
  assert.match(ics, /DTEND:20261013T001500/);
  assert.ok(ics.includes('Meal\\, water\\; calm'));
  assert.match(ics, /RRULE:FREQ=DAILY/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /END:VCALENDAR$/);
});
