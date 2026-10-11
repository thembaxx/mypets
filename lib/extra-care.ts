import type { CareEvent, Fact, Lesson, Pet } from './care';
export const extraSources = {
  chicken: 'https://www.rspca.org.uk/adviceandwelfare/pets/chickens',
  fish: 'https://www.rspca.org.uk/adviceandwelfare/pets/fish',
  fishDiet: 'https://www.rspca.org.uk/adviceandwelfare/pets/fish/diet',
  hamster: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/hamsters/environment',
  hamsterDiet: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/hamsters/diet',
  bird: 'https://www.rspca.org.uk/adviceandwelfare/pets/birds/environment',
  birdDiet: 'https://www.rspca.org.uk/adviceandwelfare/pets/birds/diet',
  guinea: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs',
  guineaDiet: 'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet',
};
export function extraGuide(pet: Pet) {
  const gentle = pet.species === 'hamster' ? pet.ageMonths >= 18 : pet.ageMonths >= 72;
  const exercise = gentle ? 5 : 10;
  const shared = {
    meals: 2,
    exercise,
    activity: 'Gentle enrichment',
    sleepHours: 'Uninterrupted rest',
  };
  switch (pet.species) {
    case 'chicken': {
      const growing = pet.ageMonths < 5;
      return {
        ...shared,
        activity: growing ? 'A safe brooder check' : 'Scratch & explore',
        diet: growing ? 'Nutrition for a growing chick' : 'A well-fed little flock',
        dietBody: growing
          ? 'Use a complete chick starter or grower feed appropriate to their exact age. Keep suitable feed and clean water accessible; ask a poultry vet about the transition as they grow. Layer feed is for laying hens.'
          : 'Offer a complete poultry feed appropriate to their age and laying status. Keep clean water and feed available, and provide suitable grit. Treats should be a small extra.',
        portion:
          'Check the poultry-feed label and their growth or laying stage. A poultry vet can advise on grit and supplements. Avoid replacing complete feed with scraps.',
        rest: 'A secure place at dusk',
        restBody: growing
          ? 'Chicks need a safe brooder with warmth suited to their age, room to move away from heat, and careful monitoring. Ask a poultry vet for a brooding plan.'
          : 'Provide dry, secure housing and suitable perches. Close the coop at dusk and adapt the reminder to local daylight.',
        source: extraSources.chicken,
        exerciseNote: growing
          ? 'Observe comfort, feeding, and safe access to warmth without disturbing rest.'
          : 'Check their secure run, dry dust-bathing area, and room for normal flock behaviour. This is a care check, not an exercise limit.',
      };
    }
    case 'fish': {
      const known = /goldfish|angelfish/i.test(pet.breed);
      const tropical = /angelfish/i.test(pet.breed);
      return {
        ...shared,
        exercise: 5,
        activity: 'Aquarium wellbeing check',
        diet: 'Small portions. A healthy habitat.',
        dietBody: known
          ? `Choose a complete food formulated for ${tropical ? 'freshwater angelfish' : 'goldfish'}. Give small, measured portions and remove uneaten food. Growing fish may need a different feeding plan; ask an aquatic specialist.`
          : 'Identify the fish species with an aquatic specialist before choosing food or a feeding frequency. Needs vary widely. Keep the aquarium stable and avoid overfeeding.',
        portion:
          'The two feeding slots are editable placeholders. Follow a species-specific food label and specialist advice for age, size, and water temperature.',
        rest: 'A steady day and night',
        restBody:
          'Use a consistent aquarium lighting cycle with a dark resting period. Observe without tapping the glass; never replace or clean all filtration media at once.',
        source: extraSources.fishDiet,
        sleepHours: 'A dark resting period',
        exerciseNote: known
          ? `Check filtration, water quality, and the temperature range recommended for ${tropical ? 'tropical angelfish' : 'your goldfish variety'}. Goldfish and angelfish have different habitat needs.`
          : 'Confirm species, tank size, water parameters, and temperature with an aquatic specialist. A water check matters more than a play session.',
      };
    }
    case 'hamster':
      return {
        ...shared,
        meals: 1,
        activity: 'An evening forage',
        diet: 'A balanced little pantry',
        dietBody:
          'Offer a complete hamster food in a measured daily allowance, with small amounts of suitable fresh foods. Refresh drinking water and remove perishable leftovers; check their food store without emptying every cache.',
        portion:
          'Follow the food label for the hamster species and size. Dwarf and Syrian hamsters differ; an exotic-pet vet can adapt the plan for growth, age, and health.',
        rest: 'Their daytime is for dreaming',
        restBody:
          'Let your hamster sleep undisturbed during the day. Offer deep, suitable bedding, a hide, and an appropriately sized solid-surface wheel. Interact only when they wake naturally.',
        source: extraSources.hamsterDiet,
        sleepHours: 'Undisturbed daytime sleep',
        exerciseNote:
          'A short optional evening interaction when already awake. Keep tunnels, burrowing space, and a suitable wheel available; never wake them for the schedule.',
      };
    case 'bird':
      return {
        ...shared,
        activity: 'Safe flight & foraging',
        diet: 'More variety than a seed bowl',
        dietBody:
          'For budgies and other small parrots, provide an appropriate balanced diet with pellets, suitable fresh vegetables, and a limited amount of seed. Change diets gradually with an avian vet; never abruptly remove familiar food.',
        portion:
          'These freshness checks are not feeding limits. Confirm the exact bird species and age with an avian vet, especially for unweaned birds. Remove spoiled fresh foods and refresh water.',
        rest: 'A quiet night, a brighter morning',
        restBody:
          'Offer a calm, dark, uninterrupted night and a consistent lighting routine suited to the bird species. Keep the sleeping area away from noise and household fumes.',
        source: extraSources.birdDiet,
        exerciseNote:
          'Prepare a bird-safe room: shut windows and doors, cover hazards, switch off fans, and keep other pets away. Provide daily flight opportunities at their pace; this session is not a daily limit.',
      };
    case 'guinea-pig':
      return {
        ...shared,
        activity: 'Explore with a friend',
        diet: 'Hay first. Vitamin C, too.',
        dietBody:
          'Keep good-quality hay and fresh water available continuously. Offer suitable fresh vegetables and a measured guinea-pig pellet allowance. They need vitamin C from an appropriate diet; rabbit pellets are not a substitute.',
        portion:
          'Follow the guinea-pig food label for size and age. Discuss vitamin C and any supplements with your vet. Introduce new vegetables gradually.',
        rest: 'A hide for every little companion',
        restBody:
          'Provide quiet hides and a spacious safe enclosure with compatible guinea-pig company. They rest in short periods; let them retreat whenever they choose.',
        source: extraSources.guineaDiet,
        sleepHours: 'Frequent quiet breaks',
        exerciseNote:
          'Supervise a safe exploration session with hiding spots and compatible company. Continuous space to move matters more than a fixed exercise duration.',
      };
    default:
      throw new Error('Unsupported additional species');
  }
}
export function extraEvents(pet: Pet): CareEvent[] {
  const guide = extraGuide(pet);
  const event = (
    id: string,
    title: string,
    time: string,
    duration: number,
    kind: CareEvent['kind'],
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
  if (pet.species === 'hamster')
    return [
      event(
        'water',
        'Fresh water & quiet check',
        '08:00',
        5,
        'reminder',
        'Refresh water gently. Leave your sleeping hamster and their nest undisturbed.',
      ),
      event('rest', 'Protect daytime rest', '09:00', 5, 'sleep', guide.restBody),
      event('dinner', 'Evening food & water', '19:30', 10, 'meal', guide.dietBody),
      event('forage', 'Explore when awake', '20:00', guide.exercise, 'play', guide.exerciseNote),
    ];
  if (pet.species === 'fish')
    return [
      event('check', 'Water & filter check', '08:00', 5, 'reminder', guide.exerciseNote),
      event(
        'breakfast',
        'Small morning feed',
        '08:15',
        5,
        'meal',
        guide.dietBody + ' ' + guide.portion,
      ),
      event(
        'observe',
        'Observe their normal',
        '17:30',
        5,
        'reminder',
        'Watch breathing, appetite, and swimming. Check water parameters if behaviour changes and ask an aquatic specialist for advice.',
      ),
      event('dinner', 'Small evening feed', '18:00', 5, 'meal', guide.portion),
      event('bed', 'Check the lighting timer', '20:00', 5, 'sleep', guide.restBody),
    ];
  return [
    event(
      'breakfast',
      pet.species === 'guinea-pig' ? 'Hay, vitamin C & water' : 'Fresh food & water check',
      '07:30',
      10,
      'meal',
      guide.dietBody,
    ),
    event('morning', guide.activity, '09:00', guide.exercise, 'play', guide.exerciseNote),
    event(
      'space',
      'A clean, comfortable space',
      '13:00',
      10,
      'reminder',
      'Check the habitat and drinking water. Remove spoiled food, keeping the environment familiar.',
    ),
    event('dinner', 'Evening freshness check', '18:00', 10, 'meal', guide.portion),
    event(
      'bed',
      pet.species === 'chicken' ? 'Secure housing at dusk' : 'Make room for rest',
      '20:00',
      10,
      'sleep',
      guide.restBody,
    ),
  ];
}
export function extraFacts(pet: Pet): Fact[] {
  const guide = extraGuide(pet);
  const content: Record<string, [string, string, string, string]> = {
    chicken: [
      'A little scratch. A big instinct.',
      'There’s a whole world under their feet.',
      'Adult chickens need space to scratch, forage, and dust-bathe with their flock. Growing chicks need a safe, age-appropriate brooder before outdoor adventures.',
      extraSources.chicken,
    ],
    fish: [
      'Their water is their whole world.',
      'A healthy habitat makes every day better.',
      'Fish depend on a stable, suitable aquarium. Match the tank, filtration, and water conditions to the exact species. Goldfish and tropical angelfish should not share a generic habitat plan.',
      extraSources.fish,
    ],
    hamster: [
      'An explorer after hours.',
      'Their best adventures start when yours slow down.',
      'Hamsters are often busiest in the evening and at night. Watch for their natural wake-up time before offering a gentle interaction. Never wake them to practise.',
      extraSources.hamster,
    ],
    bird: [
      'Made to spread their wings.',
      'Room to fly is room to be themselves.',
      'Pet birds need opportunities to fly and explore safely. A secure room with hazards removed lets them move at their own pace; keep household fumes and other pets away.',
      extraSources.bird,
    ],
    'guinea-pig': [
      'A little company goes a long way.',
      'Life is lovelier with a compatible friend.',
      'Guinea pigs are social animals. Provide compatible guinea-pig company, plenty of space, and enough hides and resources for everyone. Introductions need care and supervision.',
      extraSources.guinea,
    ],
  };
  const [title, teaser, body, source] = content[pet.species];
  return [
    {
      id: 'world',
      title,
      teaser,
      body,
      category: 'Behaviour',
      source,
      sourceName: 'RSPCA animal welfare',
    },
    {
      id: 'nutrition',
      title: guide.diet,
      teaser: 'Their daily food should fit their world.',
      body: guide.dietBody,
      category: 'Nutrition',
      source: guide.source,
      sourceName: 'RSPCA nutrition guidance',
    },
    {
      id: 'rest',
      title: guide.rest,
      teaser: 'A calmer rhythm, at their own pace.',
      body: guide.restBody,
      category: 'Wellbeing',
      source,
      sourceName: 'RSPCA animal welfare',
    },
  ];
}
export function extraLessons(pet: Pet): Lesson[] {
  const guide = extraGuide(pet);
  const source = extraFacts(pet)[0].source;
  const fish = pet.species === 'fish';
  return [
    {
      id: fish ? 'observe' : 'trust',
      title: fish ? 'Learn their normal' : 'A little more trust',
      subtitle: fish ? 'Observe without disturbing.' : 'Let them choose the moment.',
      duration: 3,
      category: fish ? 'Observation' : 'Connection',
      color: 'peach',
      source,
      steps: fish
        ? [
            'Sit quietly beside the aquarium without tapping the glass.',
            'Watch their usual swimming, breathing, and appetite.',
            'Notice changes and record them in a reminder.',
            'Check water quality and consult an aquatic specialist if something changes.',
          ]
        : [
            'Choose a calm, familiar space and wait until they are naturally awake.',
            'Stay still and let your companion choose whether to approach. Avoid chasing or forcing contact.',
            'For an unweaned animal, follow a vet’s age-specific care plan before offering treats.',
            'Keep the moment short. Stop at any sign of stress and let them retreat.',
          ],
    },
    {
      id: 'space',
      title: fish ? 'A healthier habitat' : 'Their happy place',
      subtitle: 'Small checks make a difference.',
      duration: 5,
      category: 'Everyday',
      color: 'sage',
      source,
      steps: [
        guide.exerciseNote,
        fish
          ? 'Use appropriate water tests and compare with the recommended species range.'
          : 'Check that safe hides and movement space are available.',
        'Make one gentle improvement without disrupting the whole habitat.',
        'Record a useful follow-up reminder and keep observing.',
      ],
    },
    {
      id: 'routine',
      title: 'A familiar rhythm',
      subtitle: 'Care that fits their day.',
      duration: 3,
      category: 'Wellbeing',
      color: 'lavender',
      source: guide.source,
      steps: [
        guide.dietBody,
        guide.portion,
        guide.restBody,
        'Edit the schedule to match their actual habits and specialist advice.',
      ],
    },
  ];
}
