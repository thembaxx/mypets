export type Species = 'dog' | 'cat' | 'rabbit';
export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string;
  ageMonths: number;
  photo?: string;
  weightKg?: number;
}
export type EventKind = 'meal' | 'walk' | 'sleep' | 'play' | 'reminder';
export interface CareEvent {
  id: string;
  petId: string;
  title: string;
  time: string;
  duration: number;
  kind: EventKind;
  note: string;
  date?: string;
  repeat: 'daily' | 'once';
  notify?: boolean;
}
export interface Fact {
  id: string;
  title: string;
  teaser: string;
  body: string;
  category: string;
  source: string;
  sourceName: string;
}
export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  category: string;
  color: string;
  steps: string[];
  source: string;
}
export const sources = {
  dogDiet:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/your-dogs-diet',
  dogExercise:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/how-much-exercise-does-your-dog-need',
  dogSleep:
    'https://www.pdsa.org.uk/what-we-do/blog/dogs-and-sleep-our-top-tips-for-your-furry-friend',
  dogTraining:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/puppies-dogs/reward-based-training',
  catDiet:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/kittens-cats/the-best-diet-for-your-cat',
  catCare:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/kittens-cats/ideal-environment-for-cats',
  rabbitDiet:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/feeding-your-rabbits',
  rabbitCare:
    'https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health',
  golden: 'https://www.akc.org/expert-advice/lifestyle/fun-facts-golden-retriever/',
};
export const breedOptions: Record<Species, string[]> = {
  dog: [
    'Golden Retriever',
    'Labrador Retriever',
    'German Shepherd',
    'French Bulldog',
    'Beagle',
    'Border Collie',
    'Poodle',
    'Cocker Spaniel',
    'Dachshund',
    'Chihuahua',
    'Siberian Husky',
    'Shih Tzu',
    'Mixed breed',
  ],
  cat: [
    'Domestic Shorthair',
    'Domestic Longhair',
    'British Shorthair',
    'Maine Coon',
    'Siamese',
    'Persian',
    'Ragdoll',
    'Bengal',
    'Mixed breed',
  ],
  rabbit: [
    'Holland Lop',
    'Mini Lop',
    'Netherland Dwarf',
    'Lionhead',
    'Rex',
    'Flemish Giant',
    'Mixed breed',
  ],
};
export const demoPets: Pet[] = [
  { id: 'milo', name: 'Milo', species: 'dog', breed: 'Golden Retriever', ageMonths: 28 },
  { id: 'cleo', name: 'Cleo', species: 'cat', breed: 'Domestic Shorthair', ageMonths: 18 },
  { id: 'pip', name: 'Pip', species: 'rabbit', breed: 'Holland Lop', ageMonths: 12 },
];
export function ageLabel(months: number) {
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
}
export function lifeStage(pet: Pet): 'young' | 'adult' | 'senior' {
  const seniorAt =
    pet.species === 'dog'
      ? /Great Dane|German Shepherd|Golden|Labrador/i.test(pet.breed)
        ? 84
        : 108
      : pet.species === 'cat'
        ? 132
        : 72;
  return pet.ageMonths < (pet.species === 'rabbit' ? 7 : 12)
    ? 'young'
    : pet.ageMonths >= seniorAt
      ? 'senior'
      : 'adult';
}
export function careGuide(pet: Pet) {
  const stage = lifeStage(pet);
  if (pet.species === 'rabbit')
    return {
      meals: 2,
      exercise: 30,
      activity: 'Free-roam time',
      diet: stage === 'young' ? 'Growing rabbit nutrition' : 'Hay is the everyday hero',
      dietBody:
        'Keep fresh feeding hay or grass and clean water available all day. Offer suitable leafy greens and a measured portion of age-appropriate pellets. Introduce new foods gradually.',
      portion:
        'Follow your pellet label for weight and life stage. A rabbit-experienced vet can help choose greens and portions.',
      rest: 'A quiet hide, always available',
      restBody:
        'Rabbits rest throughout the day and are often most active at dawn and dusk. Let them choose when to retreat.',
      source: sources.rabbitDiet,
      sleepHours: 'Flexible rest',
      exerciseNote:
        'A supervised enrichment session, alongside continuous access to a spacious, rabbit-proof exercise area. This is not a daily exercise limit.',
    };
  if (pet.species === 'cat')
    return {
      meals: stage === 'young' ? 3 : 2,
      exercise: stage === 'senior' ? 5 : 10,
      activity: 'Play & pounce',
      diet:
        stage === 'young'
          ? 'Complete kitten food'
          : stage === 'senior'
            ? 'Nutrition for their next chapter'
            : 'A balanced bowl, every day',
      dietBody: `Choose a complete ${stage === 'young' ? 'kitten' : 'cat'} food suited to ${pet.name}’s age and weight. Wet food, dry food, or a measured combination can work. Keep fresh water away from the litter tray.`,
      portion:
        'Use the food label and ideal weight to measure a daily allowance. Split it across meals; include treats in that allowance.',
      rest: 'Let sleeping cats lie',
      restBody:
        'Offer warm, quiet resting places and let your cat control their rest. Short play sessions work better than a rigid sleep timetable.',
      source: sources.catDiet,
      sleepHours: 'Frequent naps',
      exerciseNote:
        'A short interactive play session. Finish with a chance to catch the toy; adapt the pace to your cat.',
    };
  const active = /Golden|Labrador|Border Collie|Husky|German Shepherd|Beagle/i.test(pet.breed);
  const gentle = /French Bulldog|Dachshund|Chihuahua|Shih Tzu/i.test(pet.breed);
  const exercise =
    stage === 'young' ? 10 : stage === 'senior' ? 15 : active ? 30 : gentle ? 15 : 20;
  return {
    meals: stage === 'young' ? (pet.ageMonths < 6 ? 3 : 2) : 2,
    exercise,
    activity:
      stage === 'young'
        ? 'Gentle discovery walk'
        : stage === 'senior'
          ? 'Easy sniff walk'
          : 'A little outdoor adventure',
    diet:
      stage === 'young'
        ? 'Fuel for a growing puppy'
        : stage === 'senior'
          ? 'Nutrition for a gentler pace'
          : 'Good food. Happy companion.',
    dietBody: `Choose a complete ${stage === 'young' ? 'puppy food, suited to their expected adult size' : 'dog food, suited to their life stage'} for ${pet.name}. Measure the daily amount and split it across meals. Keep fresh water available.`,
    portion:
      'Start with the food label’s daily allowance for ideal weight. Adjust with your vet for activity, body condition, and health. Keep treats within 10% of daily calories.',
    rest: stage === 'young' ? 'Growing takes a lot of rest' : 'A soft place to recharge',
    restBody:
      'Make room for daytime naps and a quiet overnight space. Rest needs vary with age, activity, and health; protect uninterrupted sleep.',
    source: sources.dogDiet,
    sleepHours: stage === 'young' ? 'Extra puppy rest' : 'Rest throughout the day',
    exerciseNote: `A suggested ${exercise}-minute session for a ${stage} ${pet.breed === 'Unknown' ? 'dog' : pet.breed}. Adjust for weather, fitness, and veterinary advice. Offer additional play and toilet breaks.`,
  };
}
export function defaultEvents(pet: Pet): CareEvent[] {
  const guide = careGuide(pet);
  const base = (
    id: string,
    title: string,
    time: string,
    duration: number,
    kind: EventKind,
    note: string,
  ): CareEvent => ({
    id: `${pet.id}-${id}`,
    petId: pet.id,
    title,
    time,
    duration,
    kind,
    note,
    repeat: 'daily',
  });
  return [
    base(
      'breakfast',
      pet.species === 'rabbit' ? 'Hay, greens & fresh water' : 'Breakfast & fresh water',
      '07:30',
      15,
      'meal',
      guide.dietBody,
    ),
    base(
      'morning',
      pet.species === 'dog'
        ? 'Morning sniff walk'
        : pet.species === 'cat'
          ? 'Morning play'
          : 'Morning explore',
      '08:15',
      guide.exercise,
      pet.species === 'dog' ? 'walk' : 'play',
      guide.exerciseNote,
    ),
    ...(guide.meals === 3
      ? [
          base(
            'lunch',
            'A little lunch',
            '12:30',
            10,
            'meal',
            'A measured portion from the daily food allowance.',
          ),
        ]
      : []),
    base('rest', 'Quiet time', '13:00', 90, 'sleep', guide.restBody),
    base(
      'evening',
      pet.species === 'dog'
        ? 'Evening wander'
        : pet.species === 'cat'
          ? 'Play & pounce'
          : 'Dusk free-roam',
      '17:30',
      guide.exercise,
      pet.species === 'dog' ? 'walk' : 'play',
      guide.exerciseNote,
    ),
    base(
      'dinner',
      pet.species === 'rabbit' ? 'Fresh hay & water check' : 'Dinner time',
      '18:30',
      15,
      'meal',
      guide.portion,
    ),
    base(
      'bed',
      pet.species === 'rabbit' ? 'Settle the space' : 'Wind down',
      '21:00',
      30,
      'sleep',
      guide.restBody,
    ),
  ];
}
export function factsFor(pet: Pet): Fact[] {
  const fact = (
    id: string,
    title: string,
    teaser: string,
    body: string,
    category: string,
    source: string,
  ): Fact => ({
    id,
    title,
    teaser,
    body,
    category,
    source,
    sourceName: source.includes('akc.org') ? 'American Kennel Club' : 'PDSA veterinary team',
  });
  if (pet.species === 'cat')
    return [
      fact(
        'play',
        'A tiny hunter at heart.',
        'A few minutes of play can make their whole day.',
        `For ${pet.name}, chasing and catching a toy offers an outlet for natural hunting behaviour. Try short sessions with a wand toy and finish with a successful catch. Put string toys away afterwards.`,
        'Behaviour',
        sources.catCare,
      ),
      fact(
        'space',
        'Their space says a lot.',
        'A high perch is more than a nice view.',
        'Cats feel more secure when they can choose a place to hide, climb, and watch. Separate food, water, and litter areas to make the home feel comfortable.',
        'Wellbeing',
        sources.catCare,
      ),
      fact(
        'diet',
        'Small meals, thoughtfully measured.',
        'Their routine can be simple and balanced.',
        careGuide(pet).dietBody + ' ' + careGuide(pet).portion,
        'Nutrition',
        sources.catDiet,
      ),
    ];
  if (pet.species === 'rabbit')
    return [
      fact(
        'hay',
        'A little hay. A big difference.',
        'Their favourite staple does more than fill them up.',
        'A hay-rich diet supports digestive health and helps wear down teeth. Make fresh hay or grass continuously available, and pair it with fresh water and suitable greens.',
        'Nutrition',
        sources.rabbitDiet,
      ),
      fact(
        'dusk',
        'Made for dawn and dusk.',
        'Their busy hours might be different from yours.',
        'Rabbits are often most active around dawn and dusk. Give them space to explore, chew safe items, hide, and choose when to rest.',
        'Behaviour',
        sources.rabbitCare,
      ),
      fact(
        'health',
        'Know their normal.',
        'Everyday habits tell an important story.',
        'Check appetite and droppings daily. If your rabbit stops eating or producing droppings, contact a vet promptly rather than waiting for their next meal.',
        'Wellbeing',
        sources.rabbitCare,
      ),
    ];
  return [
    fact(
      'sniff',
      'A walk is a world of stories.',
      'Let them stop. There’s a whole world in every sniff.',
      `For ${pet.name}, a walk is a chance to explore as well as exercise. Leave room for relaxed sniffing and add simple scent games at home. Mental activity can be a useful part of a daily routine, especially for working breeds.`,
      'Behaviour',
      sources.dogExercise,
    ),
    ...(/Golden/i.test(pet.breed)
      ? [
          fact(
            'golden',
            'A retriever, through and through.',
            'That love of carrying things has a history.',
            'Golden Retrievers were developed as sporting dogs. Many enjoy retrieving and activities with their people. Use a safe, appropriately sized toy and keep games suited to fitness and age.',
            'Breed story',
            sources.golden,
          ),
        ]
      : [
          fact(
            'reward',
            'Good things make learning stick.',
            'A little reward goes a long way.',
            'Reward a behaviour you want right when it happens. Keep practice short and kind; punishment can undermine trust and does not teach the behaviour you want instead.',
            'Training',
            sources.dogTraining,
          ),
        ]),
    fact(
      'rest',
      'Rest is part of a good day.',
      'Doing less is sometimes doing more.',
      careGuide(pet).restBody +
        ' A predictable routine and gentle enrichment help create a comfortable daily rhythm.',
      'Wellbeing',
      sources.dogSleep,
    ),
    fact(
      'food',
      'Treats count, too.',
      'Small rewards still belong in the daily allowance.',
      careGuide(pet).portion,
      'Nutrition',
      sources.dogDiet,
    ),
  ];
}
export function lessonsFor(pet: Pet): Lesson[] {
  const lesson = (
    id: string,
    title: string,
    subtitle: string,
    duration: number,
    category: string,
    color: string,
    steps: string[],
    source: string,
  ): Lesson => ({ id, title, subtitle, duration, category, color, steps, source });
  if (pet.species === 'rabbit')
    return [
      lesson(
        'trust',
        'A little more trust',
        'Let them come to you.',
        3,
        'Connection',
        'peach',
        [
          'Sit quietly on the floor in a safe space.',
          'Let your rabbit approach in their own time. Avoid lifting or chasing.',
          'Offer a small piece of a familiar, suitable leafy green.',
          'End while they are comfortable. Repeat gently over several days.',
        ],
        sources.rabbitCare,
      ),
      lesson(
        'forage',
        'Find the good stuff',
        'Make feeding an adventure.',
        5,
        'Enrichment',
        'sage',
        [
          'Place fresh hay in a clean, safe cardboard box.',
          'Hide a few pellets from the daily allowance among the hay.',
          'Let your rabbit explore without pressure.',
          'Remove any cardboard they ingest and refresh the hay.',
        ],
        sources.rabbitDiet,
      ),
      lesson(
        'routine',
        'A familiar routine',
        'Create a calm daily rhythm.',
        4,
        'Everyday',
        'lavender',
        [
          'Refresh hay and water at consistent times.',
          'Provide a spacious exercise area and safe hide.',
          'Observe their usual eating and droppings.',
          'Let them rest undisturbed and seek veterinary advice for changes.',
        ],
        sources.rabbitCare,
      ),
    ];
  if (pet.species === 'cat')
    return [
      lesson(
        'play',
        'The perfect little pounce',
        'Play like a tiny hunter.',
        5,
        'Enrichment',
        'peach',
        [
          'Choose a wand toy and clear a safe space.',
          'Move the toy away from your cat like small prey.',
          'Pause to give them a chance to stalk.',
          'Let them catch it, then finish calmly. Store string toys safely.',
        ],
        sources.catCare,
      ),
      lesson(
        'carrier',
        'Make the carrier a friend',
        'A calmer journey starts at home.',
        5,
        'Everyday',
        'sage',
        [
          'Leave the open carrier in a familiar room.',
          'Add a comfortable blanket with a familiar scent.',
          'Place a few treats nearby, then just inside.',
          'Let your cat enter voluntarily. Build up slowly without closing the door at first.',
        ],
        sources.catCare,
      ),
      lesson(
        'space',
        'Their happy place',
        'A home with choices.',
        3,
        'Connection',
        'lavender',
        [
          'Offer a quiet hiding spot.',
          'Add a stable perch for watching.',
          'Keep water, food, and litter in separate areas.',
          'Allow your cat to choose when to interact.',
        ],
        sources.catCare,
      ),
    ];
  return [
    lesson(
      'sit',
      'Sit, stay a little',
      'The beginning of a lovely habit.',
      lifeStage(pet) === 'young' ? 3 : 5,
      'Foundations',
      'peach',
      [
        'Choose a quiet spot and a small reward.',
        'Hold the reward just above the nose and slowly move it back.',
        'When their bottom touches the floor, mark it with “yes” and reward.',
        'Repeat a few times. Add the word “sit” once the movement is familiar. Never push them down.',
      ],
      sources.dogTraining,
    ),
    lesson(
      'leash',
      'Walk together',
      'Less pulling. More exploring.',
      8,
      'Everyday',
      'sage',
      [
        'Start somewhere quiet with a comfortable harness and lead.',
        'Reward your dog for being near your side.',
        'If the lead tightens, pause. Continue when it relaxes.',
        'Take a few steps, reward, and let them sniff. Keep practice short.',
      ],
      sources.dogTraining,
    ),
    lesson(
      'recall',
      'Here, with you',
      'Build a recall they love.',
      5,
      'Foundations',
      'lavender',
      [
        'Start indoors or in a secure enclosed space.',
        'Say their name followed by “come” in a cheerful voice.',
        'Reward warmly when they reach you.',
        'Gradually add distance. Use a long line outside until recall is reliable.',
      ],
      sources.dogTraining,
    ),
    lesson(
      'settle',
      lifeStage(pet) === 'senior' ? 'Gentle connection' : 'The art of doing less',
      lifeStage(pet) === 'senior' ? 'Easy practice, at their pace.' : 'A calm place to settle.',
      3,
      'Connection',
      'butter',
      [
        'Place a comfortable mat in a quiet room.',
        'Reward any voluntary interest in the mat.',
        'Reward relaxed lying down without asking for a long stay.',
        'Practise briefly. Let your dog leave whenever they want.',
      ],
      sources.dogTraining,
    ),
  ];
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function eventsForDate(events: CareEvent[], petId: string, date: string) {
  return events
    .filter((e) => e.petId === petId && (e.repeat === 'daily' || e.date === date))
    .sort((a, b) => a.time.localeCompare(b.time));
}
export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function timeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}
export function periodLabel(time: string) {
  return Number(time.split(':')[0]) < 12 ? 'AM' : 'PM';
}
export function calendarExport(events: CareEvent[], pet: Pet, selected: Date) {
  const stamp = (date: Date) =>
    `${dateKey(date).replaceAll('-', '')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
  const escape = (s: string) =>
    s
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll(',', '\\,')
      .replaceAll(';', '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Pets//Care calendar//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const e of events) {
    const start = new Date(e.date ? `${e.date}T${e.time}` : `${dateKey(selected)}T${e.time}`);
    const end = new Date(start.getTime() + e.duration * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@mypets.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(pet.name + ' · ' + e.title)}`,
      `DESCRIPTION:${escape(e.note)}`,
      ...(e.repeat === 'daily' ? ['RRULE:FREQ=DAILY'] : []),
      ...(e.notify
        ? [
            'BEGIN:VALARM',
            'TRIGGER:PT0M',
            'ACTION:DISPLAY',
            `DESCRIPTION:${escape(e.title)}`,
            'END:VALARM',
          ]
        : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
