// A working identity, kept in one place so the name can evolve without losing saved pets.
export const brand = {
  name: 'Nuzzle',
  wordmark: 'nuzzle',
  tagline: 'A little care. A lot of love.',
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
