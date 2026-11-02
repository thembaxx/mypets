import { speciesList, speciesNames, type Species } from './species';

export const animalCandidateIds = [
  ...speciesList,
  'angelfish',
  'budgie',
  'canary',
] as const;
export type AnimalCandidateId = (typeof animalCandidateIds)[number];

/** A distinct, source-controlled GLB candidate for every illustrated pet. */
export function candidateModelUrl(id: AnimalCandidateId): string {
  return id === 'cat'
    ? '/models/candidates/nuzzle-calico-rig.glb'
    : '/models/candidates/species/' + id + '.glb';
}

export function candidateDisplayName(id: AnimalCandidateId): string {
  const variantNames: Partial<Record<AnimalCandidateId, string>> = {
    angelfish: 'Angelfish',
    budgie: 'Budgie',
    canary: 'Canary',
  };
  return variantNames[id] ?? speciesNames[id as Species];
}

export function candidateIsApproved(_id: AnimalCandidateId): boolean {
  // Even after merging authoring tools, real owners must review likeness,
  // mobile performance, animation quality and accessibility per species.
  return false;
}
