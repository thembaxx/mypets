export const speciesList = [
  'dog',
  'cat',
  'rabbit',
  'chicken',
  'fish',
  'hamster',
  'bird',
  'guinea-pig',
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
};
export function animalAsset(species: Species, breed = '') {
  if (species === 'fish' && /angelfish/i.test(breed)) return 'angelfish';
  if (species === 'bird' && /english/i.test(breed)) return 'budgie';
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
};
