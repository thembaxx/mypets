import type { CareEvent, Fact, Lesson, Pet } from './care';
import type { Species } from './species';

export const exoticSpecies = [
  'snake',
  'hedgehog',
  'ferret',
  'salamander',
  'iguana',
  'gecko',
] as const;
type ExoticSpecies = (typeof exoticSpecies)[number];
export function isExotic(species: Species): species is ExoticSpecies {
  return exoticSpecies.some((value) => value === species);
}
const sources: Record<ExoticSpecies, { url: string; name: string }> = {
  snake: {
    url: 'https://www.rspca.org.uk/adviceandwelfare/pets/other/royalpython',
    name: 'RSPCA reptile care',
  },
  hedgehog: {
    url: 'https://www.msdvetmanual.com/exotic-and-laboratory-animals/four-toed-african-pygmy-hedgehogs/management-of-four-toed-african-pygmy-hedgehogs',
    name: 'MSD Veterinary Manual',
  },
  ferret: {
    url: 'https://www.rspca.org.uk/adviceandwelfare/pets/ferrets',
    name: 'RSPCA ferret care',
  },
  salamander: {
    url: 'https://www.msdvetmanual.com/exotic-and-laboratory-animals/amphibians/overview-of-amphibians',
    name: 'MSD Veterinary Manual',
  },
  iguana: {
    url: 'https://www.msdvetmanual.com/exotic-and-laboratory-animals/reptiles/management-and-husbandry-of-reptiles',
    name: 'MSD Veterinary Manual',
  },
  gecko: {
    url: 'https://www.rspca.org.uk/adviceandwelfare/pets/other/leopardgecko',
    name: 'RSPCA reptile care',
  },
};

function sourceFor(pet: Pet) {
  if (!isExotic(pet.species)) throw new Error('Unsupported exotic species');
  if (pet.species === 'gecko' && /crested gecko/i.test(pet.breed))
    return {
      url: 'https://www.rspca.org.uk/adviceandwelfare/pets/other/crestedgecko',
      name: 'RSPCA reptile care',
    };
  if (
    (pet.species === 'snake' && !/ball python/i.test(pet.breed)) ||
    (pet.species === 'gecko' && !/leopard gecko/i.test(pet.breed))
  )
    return sources.iguana;
  return sources[pet.species];
}

export function exoticGuide(pet: Pet) {
  if (!isExotic(pet.species)) throw new Error('Unsupported exotic species');
  const young =
    pet.ageMonths <
    {
      snake: /corn snake/i.test(pet.breed) ? 24 : 36,
      hedgehog: 6,
      ferret: 12,
      salamander: 24,
      iguana: 36,
      gecko: 18,
    }[pet.species];
  const shared = {
    meals: 2,
    exercise: 5,
    activity: 'A gentle habitat check',
    source: sourceFor(pet).url,
    sleepHours: 'A consistent light and dark cycle',
    portion: `Confirm the exact species, body condition, and ${young ? 'growth stage' : 'adult needs'} with an exotic-pet vet. Keep a feeding log and adapt the plan as they age.`,
  };
  switch (pet.species) {
    case 'snake':
      return {
        ...shared,
        activity: 'Observe from a little distance',
        diet: 'A feeding rhythm, not a daily bowl',
        dietBody: /ball python|corn snake/i.test(pet.breed)
          ? `For ${pet.breed}, use suitably sized, safely thawed frozen prey from a reputable supplier. Never offer live prey. Feeding intervals depend on age, size, body condition, and health; ${young ? 'growing snakes often need a different interval from adults' : 'adult meals are spaced days or weeks apart'}. The daily reminders are checks, not instructions to feed.`
          : 'Identify the snake species before choosing food or a feeding interval. Snake diets differ. An exotic-pet vet should set a plan; the daily schedule only checks water, habitat, and the feeding log.',
        rest: 'A secure hide on each side',
        restBody:
          'Provide secure hides in the warm and cool areas, fresh water, and an escape-proof enclosure. Follow the exact species guidance for a thermostatically controlled temperature gradient, humidity, and lighting. Never handle after a meal or during a stressful shed.',
        exerciseNote:
          'Check temperature and humidity readings, hide access, water, and enclosure security. Observe natural exploration without forcing handling.',
      };
    case 'hedgehog':
      return {
        ...shared,
        meals: 1,
        exercise: pet.ageMonths >= 36 ? 5 : 10,
        activity: 'An evening sniff and explore',
        diet: 'A measured evening pantry',
        dietBody:
          'For an African pygmy hedgehog, offer a suitable balanced insectivore diet agreed with an exotic-pet vet, with appropriate insects as part of the plan. Keep fresh water available. Measure food and monitor body condition; avoid milk, sugary treats, and an insect-only diet.',
        rest: 'Their daytime belongs to sleep',
        restBody:
          'Keep a quiet nest, a safe solid-surface wheel, and suitable warmth for the exact species. Let them wake naturally in the evening. A pet African pygmy hedgehog becoming cold, lethargic, or attempting hibernation needs prompt veterinary advice.',
        sleepHours: 'Undisturbed daytime rest',
        exerciseNote:
          'Offer safe supervised exploration when already awake, with hides and a suitable wheel available. Let them approach and stop if they curl tightly or seem stressed.',
      };
    case 'ferret':
      return {
        ...shared,
        exercise: pet.ageMonths >= 60 ? 10 : 15,
        activity: 'Tunnels, play and a little company',
        diet: 'A little carnivore’s complete diet',
        dietBody:
          'Ferrets are obligate carnivores. Provide a complete ferret food with suitable animal protein and fat, and fresh water. They eat small amounts frequently; freshness checks are not meal limits. Avoid fruit, sugary treats, and foods formulated for herbivores.',
        rest: 'A soft hide between adventures',
        restBody:
          'Offer quiet sleeping spaces and allow long, undisturbed naps. Give daily supervised play outside their secure enclosure. Check small gaps and remove rubber, foam, or other items they might swallow.',
        sleepHours: 'Long naps and quiet breaks',
        exerciseNote:
          'Ferret-proof the space and supervise tunnels, exploration, and reward-based play. This short session is one part of daily enrichment, not their whole exercise allowance.',
      };
    case 'salamander':
      return {
        ...shared,
        activity: 'A quiet moisture check',
        diet: 'Food matched to the exact amphibian',
        dietBody: /fire|tiger salamander/i.test(pet.breed)
          ? 'For a terrestrial fire or tiger salamander, offer appropriate invertebrate prey sized to the animal, with a supplementation plan from an amphibian specialist. Remove uneaten prey. Feeding frequency depends on species, age, temperature, and body condition; a daily check does not mean a daily meal.'
          : 'Identify the exact salamander species and life stage before choosing prey, supplementation, or water setup. Aquatic larvae and terrestrial adults have different needs. Ask an amphibian specialist to set the feeding plan.',
        rest: 'A cool, quiet retreat',
        restBody:
          'For terrestrial species, provide suitable moist substrate, hides, ventilation, and species-appropriate temperature and water access. Use amphibian-safe, dechlorinated water. Their sensitive skin makes observation preferable to handling; never force contact.',
        exerciseNote:
          'Read the habitat conditions without disturbing the animal. Check moisture, water, hides, and signs of normal activity. Terrestrial and aquatic salamanders need different habitats.',
      };
    case 'iguana':
      return {
        ...shared,
        activity: 'Basking and climbing, their way',
        diet: 'Leafy greens for a growing herbivore',
        dietBody: /green iguana/i.test(pet.breed)
          ? 'Green iguanas are herbivores. Offer a varied, suitable leafy-green and vegetable diet, with calcium and other supplements guided by a reptile vet. Avoid animal protein. Refresh food and water daily; growing iguanas need a plan matched to their development.'
          : 'Confirm the exact iguana species and its diet with a reptile specialist. The green-iguana character is an illustration, not a species identification. Do not assume every iguana has the same food or habitat needs.',
        rest: 'Room to climb, space to retreat',
        restBody:
          'For a green iguana, provide a large secure enclosure with strong climbing branches, species-appropriate UVB, a thermostatically controlled basking area, and humidity monitoring. Follow a consistent day and night cycle; lighting and heat need separate controls.',
        exerciseNote:
          'Check basking readings, UVB setup and lamp age, humidity, and stable climbing branches. Allow voluntary movement and retreat; do not force handling.',
      };
    case 'gecko': {
      const leopard = /leopard gecko/i.test(pet.breed);
      const crested = /crested gecko/i.test(pet.breed);
      return {
        ...shared,
        activity: 'An evening habitat check',
        diet: leopard
          ? 'A varied insect menu'
          : crested
            ? 'Complete food for a crested gecko'
            : 'Their species sets the menu',
        dietBody: leopard
          ? 'Leopard geckos are insectivores. Offer varied, suitably sized, gut-loaded feeder insects with calcium and vitamin supplementation guided by a reptile vet. Remove uneaten insects. Young geckos and adults need different feeding intervals; this schedule checks the plan daily without assuming daily feeding.'
          : crested
            ? 'Use a complete crested-gecko diet prepared as directed, with appropriate insects where advised by a reptile specialist. Refresh food and water as recommended. A leopard-gecko insect-only plan does not fit a crested gecko.'
            : 'Identify the exact gecko species before choosing food or a feeding frequency. Leopard and crested geckos need different diets and habitats. Keep fresh water available and ask a reptile specialist to set the plan.',
        rest: 'A hide to call their own',
        restBody: leopard
          ? 'Provide secure warm, cool, and humid hides, species-appropriate UVB, and a thermostatically controlled heat gradient. Let them rest by day and explore at their own pace. Never pick a gecko up by its tail.'
          : 'Match climbing space, hides, UVB, temperature, and humidity to the exact gecko species. Maintain a consistent light and dark cycle. Never restrain or lift a gecko by its tail.',
        exerciseNote:
          'Check temperature, humidity, hides, water, and enclosure security. Observe evening exploration without chasing or waking them.',
      };
    }
  }
}

export function exoticEvents(pet: Pet): CareEvent[] {
  const guide = exoticGuide(pet);
  const event = (
    id: string,
    title: string,
    time: string,
    kind: CareEvent['kind'],
    note: string,
    duration = 5,
  ): CareEvent => ({
    id: `${pet.id}-${id}`,
    petId: pet.id,
    title,
    time,
    kind,
    note,
    duration,
    repeat: 'daily',
  });
  if (pet.species === 'hedgehog')
    return [
      event(
        'water',
        'Fresh water & quiet check',
        '08:00',
        'reminder',
        'Refresh water without waking your hedgehog. Check their warmth and leave the nest undisturbed.',
      ),
      event('rest', 'Protect daytime rest', '09:00', 'sleep', guide.restBody),
      event('dinner', 'Measured evening food', '19:30', 'meal', guide.dietBody),
      event('explore', 'Explore when awake', '20:00', 'play', guide.exerciseNote, guide.exercise),
    ];
  if (pet.species === 'ferret')
    return [
      event('breakfast', 'Food & water freshness', '07:30', 'meal', guide.dietBody),
      event('play', 'Supervised tunnel play', '09:00', 'play', guide.exerciseNote, guide.exercise),
      event('rest', 'A quiet nap space', '12:00', 'sleep', guide.restBody),
      event('dinner', 'Refresh food & water', '18:00', 'meal', guide.portion),
      event(
        'explore',
        'Ferret-proof exploration',
        '19:00',
        'play',
        guide.exerciseNote,
        guide.exercise,
      ),
    ];
  return [
    event('habitat', 'Habitat readings & equipment', '08:00', 'reminder', guide.exerciseNote),
    event(
      'water',
      'Fresh water & a clean space',
      '08:15',
      'reminder',
      pet.species === 'salamander'
        ? 'Use amphibian-safe, dechlorinated water. Check suitable moisture, water access, and clean substrate for the exact species.'
        : 'Refresh drinking water, spot-clean waste, and check enclosure security without disturbing hides.',
    ),
    event(
      'food',
      pet.species === 'iguana' && /green iguana/i.test(pet.breed)
        ? 'Refresh the leafy-green menu'
        : 'Review the feeding log',
      '18:00',
      pet.species === 'iguana' && /green iguana/i.test(pet.breed) ? 'meal' : 'reminder',
      guide.dietBody + ' ' + guide.portion,
      10,
    ),
    event('observe', guide.activity, '19:00', 'reminder', guide.exerciseNote),
    event('rest', 'Check the night-time setup', '20:00', 'sleep', guide.restBody),
  ];
}

export function exoticFacts(pet: Pet): Fact[] {
  if (!isExotic(pet.species)) return [];
  const guide = exoticGuide(pet);
  const source = sourceFor(pet);
  const stories: Record<ExoticSpecies, [string, string, string]> = {
    snake: [
      'Their tongue reads the room.',
      'A quiet explorer has a different way to sense the world.',
      'Snakes collect chemical cues with their forked tongues and deliver them to a specialised sensory organ. Tongue flicks help them investigate; they are not an invitation to handle. Watch calmly and give them a secure place to retreat.',
    ],
    hedgehog: [
      'Adventures after sunset.',
      'Their evening begins when yours slows down.',
      'African pygmy hedgehogs are naturally active at night. Give them opportunities to sniff, forage, and use a suitable solid-surface wheel when awake. A daytime invitation can wait until they wake naturally.',
    ],
    ferret: [
      'A tunnel is an invitation.',
      'Curiosity is part of their everyday world.',
      'Ferrets investigate tight spaces and need daily supervised play. Safe tunnels and hiding places support that curiosity. Ferret-proof small gaps and remove chewable rubber and foam that could cause an obstruction.',
    ],
    salamander: [
      'Look closely. Touch lightly.',
      'Their skin is part of how they meet the world.',
      'Amphibian skin is sensitive to drying and contaminants. Habitat moisture and suitable water are essential. Enjoy watching rather than unnecessary handling, and follow an amphibian specialist’s care plan for the exact species.',
    ],
    iguana: [
      'Built for a leafy, climbing world.',
      'A green iguana needs room above the ground.',
      'Green iguanas are herbivorous climbers that can become large adults. Strong branches, suitable space, UVB, and a controlled basking area support normal behaviour. Planning for their adult size matters from the beginning.',
    ],
    gecko: [
      'One name. Different little worlds.',
      'Their exact species changes the care plan.',
      'A leopard gecko lives differently from a crested gecko. Diet, climbing space, temperature, and humidity must match the species. The supplied spotted character illustrates a leopard gecko; it cannot identify your real pet.',
    ],
  };
  const [title, teaser, body] = stories[pet.species];
  return [
    {
      id: 'world',
      title,
      teaser,
      body,
      category: 'Behaviour',
      source: source.url,
      sourceName: source.name,
    },
    {
      id: 'nutrition',
      title: guide.diet,
      teaser: 'A menu that fits their species and age.',
      body: guide.dietBody,
      category: 'Nutrition',
      source: guide.source,
      sourceName: source.name,
    },
    {
      id: 'rest',
      title: guide.rest,
      teaser: 'A calmer rhythm, with room to retreat.',
      body: guide.restBody,
      category: 'Wellbeing',
      source: source.url,
      sourceName: source.name,
    },
  ];
}

export function exoticLessons(pet: Pet): Lesson[] {
  const guide = exoticGuide(pet);
  const mammal = pet.species === 'ferret' || pet.species === 'hedgehog';
  return [
    {
      id: mammal ? 'trust' : 'observe',
      title: mammal ? 'Trust at their pace' : 'Learn their normal',
      subtitle: mammal ? 'A little choice goes a long way.' : 'Notice without disturbing.',
      duration: 3,
      category: mammal ? 'Connection' : 'Observation',
      color: 'peach',
      source: guide.source,
      steps: mammal
        ? [
            'Wait until they are naturally awake and comfortable.',
            'Prepare a familiar safe space and let them choose whether to approach.',
            guide.exerciseNote,
            'Keep the visit short and let them retreat. Never chase or force contact.',
          ]
        : [
            'Observe quietly without tapping the enclosure or moving a hide.',
            'Notice normal activity, posture, appetite, and any shedding changes.',
            guide.exerciseNote,
            'Record changes and ask an exotic-pet vet if something seems unusual.',
          ],
    },
    {
      id: 'habitat',
      title: 'Their habitat, thoughtfully checked',
      subtitle: 'Small readings. A calmer world.',
      duration: 5,
      category: 'Everyday',
      color: 'sage',
      source: guide.source,
      steps: [
        guide.exerciseNote,
        guide.restBody,
        'Record equipment readings and maintenance dates in a reminder.',
        'Make changes gradually with species-specific professional advice.',
      ],
    },
    {
      id: 'feeding-log',
      title: 'A feeding rhythm that fits',
      subtitle: 'Age, species and body condition matter.',
      duration: 3,
      category: 'Wellbeing',
      color: 'lavender',
      source: guide.source,
      steps: [
        guide.dietBody,
        guide.portion,
        'Record actual feeding dates, amounts, appetite, and weight trends.',
        'Edit reminders to the agreed plan. A daily check is not a daily feeding instruction.',
      ],
    },
  ];
}
