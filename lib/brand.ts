// A working identity, kept in one place so the name can evolve without losing saved pets.
export const brand = {
  name: 'Nuzzle',
  wordmark: 'nuzzle',
  tagline: 'A little care. A lot of love.',
  title: 'Nuzzle — Daily pet care, routines & training',
  description:
    'Plan daily pet care, reminders and species-specific enrichment with Nuzzle. Keep profiles, care history and an optional offline companion on your device.',
  language: 'en',
  locale: 'en_US',
  category: 'LifestyleApplication',
  features: [
    'Daily care plans tailored to species, age and selected breed',
    'Editable schedules, completion history and device-calendar exports',
    'Species-specific training, enrichment and sourced care notes',
    'Browser-local pet profiles, photos, routines and backups',
    'Installable offline app and optional on-device text companion',
  ],
  limits: [
    'Care information is educational. It does not diagnose illness or replace a veterinarian.',
    'Photo recognition provides suggestions to confirm; it cannot establish breed ancestry.',
    'Models need an initial download and compatible hardware. The core care app works without them.',
    'Records and conversations stay in this browser. There is no account or cross-device sync.',
    'Closed-app reminders rely on exported calendar events; browser reminders require the app to be running.',
    'Sample pets and seeded history are demonstrations, not records of a visitor’s pets.',
  ],
  sources: [
    ['PDSA pet care', 'https://www.pdsa.org.uk/pet-help-and-advice'],
    ['RSPCA animal advice', 'https://www.rspca.org.uk/adviceandwelfare/pets'],
    ['MSD Veterinary Manual', 'https://www.msdvetmanual.com/'],
  ],
};
export const brandDirections = [
  {
    name: 'Nuzzle',
    key: 'nuzzle',
    line: 'A little closer.',
    description:
      'Warm, memorable, and made for every kind of companion. Two soft forms lean together; an apricot dot adds a little life.',
  },
  {
    name: 'Pippa',
    key: 'pippa',
    line: 'Small moments. Big love.',
    description:
      'A playful, character-led direction. A folded ear and a warm apricot tile make everyday care feel approachable.',
  },
  {
    name: 'Kindred',
    key: 'kindred',
    line: 'Grow together.',
    description:
      'A quieter, more editorial direction. Interlocking loops express the bond between you and your companion.',
  },
] as const;
