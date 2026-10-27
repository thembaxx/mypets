import { dateKey, eventOccursOnDate, validDateKey } from './care';
import { speciesNames } from './species';
import type { AppData } from './storage';

export interface HandoffEntry {
  date: string;
  time?: string;
  title: string;
  note: string;
  kind: 'care' | 'practice' | 'note';
}

export interface CaregiverHandoff {
  pet: { id: string; name: string; species: string; breed: string; ageMonths: number };
  sample: boolean;
  generatedAt: string;
  timeZone: string;
  fromDate: string;
  throughDate: string;
  upcomingUntil: string;
  recent: HandoffEntry[];
  recentOmitted: number;
  upcoming: HandoffEntry[];
  upcomingOmitted: number;
}

/** A bounded, selected-pet projection. Photos, chats and other pets never enter it. */
export function buildCaregiverHandoff(
  data: AppData,
  petId: string,
  now = new Date(),
): CaregiverHandoff | null {
  const pet = data.pets.find((entry) => entry.id === petId);
  if (!pet || !Number.isFinite(now.getTime())) return null;
  const firstDay = new Date(now);
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() - 6);
  const fromDate = dateKey(firstDay);
  const today = dateKey(now);
  const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const events = data.events.filter((entry) => entry.petId === petId);
  const byId = new Map(events.map((entry) => [entry.id, entry]));
  const completed = new Set(data.completed);
  const recent: HandoffEntry[] = [];
  for (const key of completed) {
    const date = key.slice(0, 10);
    const event = byId.get(key.slice(11));
    if (key[10] !== ':' || !event || !validDateKey(date) || date < fromDate || date > today)
      continue;
    recent.push({ date, title: event.title, note: event.note, kind: 'care' });
  }
  for (const entry of data.history ?? []) {
    if (
      entry.petId !== petId ||
      !validDateKey(entry.date) ||
      entry.date < fromDate ||
      entry.date > today
    )
      continue;
    recent.push({ date: entry.date, title: entry.title, note: entry.note, kind: entry.kind });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const upcoming: HandoffEntry[] = [];
  // Walk local dates while timestamps bound the window across daylight-saving changes.
  for (let offset = 0; offset <= 3; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const date = dateKey(day);
    for (const event of events) {
      if (!eventOccursOnDate(event, date) || completed.has(`${date}:${event.id}`)) continue;
      const scheduled = new Date(`${date}T${event.time}:00`);
      if (!Number.isFinite(scheduled.getTime()) || scheduled < now || scheduled > until) continue;
      upcoming.push({ date, time: event.time, title: event.title, note: event.note, kind: 'care' });
    }
  }
  upcoming.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return {
    pet: {
      id: pet.id,
      name: pet.name,
      species: speciesNames[pet.species],
      breed: pet.breed,
      ageMonths: pet.ageMonths,
    },
    sample: data.demoMode === true,
    generatedAt: now.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    fromDate,
    throughDate: today,
    upcomingUntil: until.toISOString(),
    recent: recent.slice(0, 30),
    recentOmitted: Math.max(0, recent.length - 30),
    upcoming: upcoming.slice(0, 30),
    upcomingOmitted: Math.max(0, upcoming.length - 30),
  };
}

export function handoffText(handoff: CaregiverHandoff): string {
  const entryText = (entry: HandoffEntry) =>
    `- ${entry.date}${entry.time ? ` ${entry.time}` : ''} · ${entry.title} (${entry.kind})${entry.note ? `\n  ${entry.note}` : ''}`;
  return [
    `Nuzzle caregiver handoff · ${handoff.pet.name}`,
    ...(handoff.sample
      ? ['SAMPLE WORKSPACE: these are demonstration records, not actual care.']
      : []),
    `Generated: ${handoff.generatedAt}`,
    `Routine times use ${handoff.timeZone}.`,
    `${handoff.pet.species} · ${handoff.pet.breed} · ${handoff.pet.ageMonths} months old`,
    '',
    `Recent care, practice and notes · ${handoff.fromDate} to ${handoff.throughDate}`,
    ...(handoff.recent.length
      ? handoff.recent.map(entryText)
      : ['No records saved in this period.']),
    ...(handoff.recentOmitted
      ? [`${handoff.recentOmitted} older entries omitted from this handoff.`]
      : []),
    '',
    'Upcoming saved tasks · next 48 hours',
    ...(handoff.upcoming.length
      ? handoff.upcoming.map(entryText)
      : ['No upcoming tasks saved in this period.']),
    ...(handoff.upcomingOmitted
      ? [`${handoff.upcomingOmitted} later tasks omitted from this handoff.`]
      : []),
    '',
    'This is a snapshot of saved routines and caregiver logs. Routine titles and notes reflect the current saved plan. A completion is dated, without an exact completion time. Upcoming tasks are not marked complete in this snapshot.',
    'Review with the caregiver before repeating care. Changes made after generation are not included.',
    '',
  ].join('\n');
}

export function handoffFilename(handoff: CaregiverHandoff) {
  const name =
    handoff.pet.name
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'pet';
  return `nuzzle-${name}-handoff-${handoff.generatedAt.slice(0, 10)}.txt`;
}
