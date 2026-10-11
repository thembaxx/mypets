import { dateKey, defaultEvents, lessonsFor, demoPets, type CareEvent, type Pet } from './care';
import type { AppData } from './storage';

export interface HistoryEntry {
  id: string;
  petId: string;
  date: string;
  kind: 'practice' | 'note';
  title: string;
  note: string;
  minutes?: number;
  lessonId?: string;
}

const observations: Record<Pet['species'], string[]> = {
  dog: [
    'A slow sniff walk was the favourite part of the day.',
    'Settled on the mat after a short, reward-based practice.',
    'Explored a different route. Plenty of pauses to sniff.',
    'Enjoyed the puzzle feeder. Kept it easy and supervised.',
  ],
  cat: [
    'Chose the sunny window perch for an afternoon nap.',
    'Enjoyed chasing the wand, then a quiet rest.',
    'Explored the new cardboard box at their own pace.',
    'A calm brushing session, with plenty of breaks.',
  ],
  rabbit: [
    'Investigated the hay-filled cardboard tunnel.',
    'Spent time foraging with their rabbit companion.',
    'Relaxed nearby after a quiet floor-level visit.',
    'Fresh hay topped up. The favourite corner stayed tidy.',
  ],
  chicken: [
    'Scratched through the enrichment area with the flock.',
    'Water refreshed and the coop checked before dusk.',
    'Enjoyed a dry patch for dust bathing.',
    'Watched the flock together and checked that everyone could reach their feed.',
  ],
  fish: [
    'Watched feeding closely; removed uneaten food.',
    'Checked the aquarium equipment and noted normal swimming.',
    'Recorded the water test in the aquarium log.',
    'A quiet observation: active swimming and normal appetite.',
  ],
  hamster: [
    'Became active in the evening and explored the tunnel.',
    'Scattered the measured evening food for foraging.',
    'Left the daytime nest undisturbed.',
    'Checked the wheel and water when they woke up.',
  ],
  bird: [
    'Explored a new paper foraging toy under supervision.',
    'A short, calm step-up practice, with a favourite reward.',
    'Enjoyed supervised time outside the enclosure.',
    'Kept the bedtime routine calm and consistent.',
  ],
  'guinea-pig': [
    'Fresh hay topped up. Both companions explored the hideouts.',
    'Enjoyed a calm floor-level visit, without being rushed.',
    'Checked the water and replenished fresh hay.',
    'Investigated a hay-filled paper bag with their companion.',
  ],
  snake: [
    'Checked the thermostat readings and refreshed water.',
    'Observed a quiet exploration between the hides.',
    'Reviewed the last feeding date; no meal was due today.',
    'Logged humidity and left the shedding snake undisturbed.',
  ],
  hedgehog: [
    'Woke naturally after dusk and explored the tunnel.',
    'Checked the solid-surface wheel and measured evening food.',
    'Left the daytime nest quiet and checked the warmth.',
    'Sniffed around a familiar hide during a short evening visit.',
  ],
  ferret: [
    'Explored the safe tunnels during supervised play.',
    'Checked small gaps and removed a damaged toy.',
    'Refreshed complete ferret food and drinking water.',
    'Curled up in a quiet hide after an active play session.',
  ],
  salamander: [
    'Checked suitable moisture and dechlorinated water.',
    'Observed from outside the enclosure without handling.',
    'Reviewed the feeding log and removed uneaten prey.',
    'Recorded habitat conditions and checked the hides.',
  ],
  iguana: [
    'Refreshed leafy greens and noted normal appetite.',
    'Checked the basking readings and UVB maintenance date.',
    'Observed voluntary climbing along a stable branch.',
    'Refreshed drinking water and recorded humidity.',
  ],
  gecko: [
    'Checked the warm, cool, and humid hides.',
    'Observed evening exploration without lifting or chasing.',
    'Reviewed the feeding log and supplementation plan.',
    'Logged temperature readings and refreshed water.',
  ],
};

export function seedDemoHistory(
  data: AppData,
  now = new Date(),
  addedPetIds: string[] = [],
): AppData {
  if (!data.demoMode || (data.demoSeedVersion === 1 && !addedPetIds.length)) return data;
  const completed = new Set(data.completed);
  const trained = new Set(data.trained);
  const history: HistoryEntry[] = [...(data.history ?? [])];
  const events: CareEvent[] = [...data.events];
  const seedPets =
    data.demoSeedVersion === 1
      ? data.pets.filter((pet) => addedPetIds.includes(pet.id))
      : data.pets;
  seedPets.forEach((pet, petIndex) => {
    const daily = data.events.filter((event) => event.petId === pet.id && event.repeat === 'daily');
    const lessons = lessonsFor(pet);
    for (let ago = 30; ago >= 1; ago--) {
      const day = new Date(now);
      day.setDate(day.getDate() - ago);
      const date = dateKey(day);
      daily.forEach((event, index) => {
        // A believable rhythm, with a few unlogged moments rather than a perfect month.
        if ((ago + index + petIndex) % 11 !== 0) completed.add(`${date}:${event.id}`);
      });
      if (ago % 3 === petIndex % 3) {
        const lesson = lessons[(Math.floor(ago / 3) + petIndex) % lessons.length];
        trained.add(`${pet.id}:${lesson.id}`);
        history.push({
          id: `demo-practice-${pet.id}-${date}`,
          petId: pet.id,
          date,
          kind: 'practice',
          title: lesson.title,
          note: `A short, calm session. Finished while ${pet.name} was still comfortable and interested.`,
          minutes: lesson.duration,
          lessonId: lesson.id,
        });
      }
      if (ago % 4 === petIndex % 4) {
        const notes =
          pet.species === 'bird' && /canary/i.test(pet.breed)
            ? [
                'Observed normal perching and quiet songbird activity.',
                'Refreshed the canary food and water without an abrupt diet change.',
                'Checked safe flight space and suitable perches.',
                'Kept the evening lighting routine calm and consistent.',
              ]
            : observations[pet.species];
        history.push({
          id: `demo-note-${pet.id}-${date}`,
          petId: pet.id,
          date,
          kind: 'note',
          title: 'A little observation',
          note: notes[Math.floor(ago / 4) % notes.length],
        });
      }
    }
    for (const ago of [22, 8, -5]) {
      const day = new Date(now);
      day.setDate(day.getDate() - ago);
      const date = dateKey(day);
      const id = `demo-review-${pet.id}-${date}`;
      if (!events.some((event) => event.id === id))
        events.push({
          id,
          petId: pet.id,
          title: ago === 22 ? 'Refresh the enrichment' : 'Weekly care check-in',
          time: '18:30',
          duration: 10,
          kind: 'reminder',
          repeat: 'once',
          date,
          notify: false,
          note: `Review ${pet.name}’s routine, appetite, environment, and any changes you’ve noticed. Write down questions for your vet or species specialist.`,
        });
      if (ago > 0) completed.add(`${date}:${id}`);
    }
  });
  return {
    ...data,
    events,
    completed: [...completed],
    trained: [...trained],
    history,
    demoSeedVersion: 1,
  };
}

export function createDemoData(now = new Date()): AppData {
  // Imported here via care's stable catalogue; no generated history ever touches personal profiles.
  return seedDemoHistory(
    {
      version: 1,
      pets: demoPets,
      activePetId: 'milo',
      events: demoPets.flatMap(defaultEvents),
      completed: [],
      trained: [],
      history: [],
      onboarded: false,
      sound: false,
      demoMode: true,
      appearance: 'system',
    },
    now,
  );
}

export function recentDays(now = new Date(), count = 30): string[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - count + index + 1);
    return dateKey(day);
  });
}
export function careCount(data: AppData, petId: string, date: string): number {
  const eventIds = new Set(
    data.events.filter((event) => event.petId === petId).map((event) => event.id),
  );
  return data.completed.filter(
    (key) => key.startsWith(date + ':') && eventIds.has(key.slice(date.length + 1)),
  ).length;
}
