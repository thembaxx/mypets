export const speciesList = [
  'dog',
  'cat',
  'rabbit',
  'chicken',
  'fish',
  'hamster',
  'bird',
  'guinea-pig',
  'snake',
  'hedgehog',
  'ferret',
  'salamander',
  'iguana',
  'gecko',
] as const;
export type Species = (typeof speciesList)[number];
export const speciesNames: Record<Species, string> = {
  dog: 'Dog',
  cat: 'Cat',
  rabbit: 'Rabbit',
  chicken: 'Chicken',
  fish: 'Fish',
  hamster: 'Hamster',
  bird: 'Bird',
  'guinea-pig': 'Guinea pig',
  snake: 'Snake',
  hedgehog: 'Hedgehog',
  ferret: 'Ferret',
  salamander: 'Salamander',
  iguana: 'Iguana',
  gecko: 'Gecko',
};
export function animalAsset(species: Species, breed = '') {
  if (species === 'fish' && /angelfish/i.test(breed)) return 'angelfish';
  if (species === 'bird' && /english/i.test(breed)) return 'budgie';
  if (species === 'bird' && /canary/i.test(breed)) return 'canary';
  return species;
}
export const discoveryTitles: Record<Species, [string, string]> = {
  dog: ['A nose for', 'new adventures.'],
  cat: ['A little hunter.', 'A lot of heart.'],
  rabbit: ['Small ears.', 'A curious world.'],
  chicken: ['Little feet.', 'Big discoveries.'],
  fish: ['A quiet world.', 'Full of wonder.'],
  hamster: ['A little explorer.', 'After hours.'],
  bird: ['A little song.', 'A brighter day.'],
  'guinea-pig': ['A happy wheek.', 'A little company.'],
  snake: ['A quiet explorer.', 'A curious world.'],
  hedgehog: ['A little night owl.', 'A world to sniff.'],
  ferret: ['Small paws.', 'Endless curiosity.'],
  salamander: ['A quieter world.', 'Worth a closer look.'],
  iguana: ['A place to bask.', 'Room to grow.'],
  gecko: ['Little footsteps.', 'A whole new world.'],
};
