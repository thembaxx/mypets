import { speciesList, speciesNames, type Species } from './species';

export const animalCandidateIds = [...speciesList, 'angelfish', 'budgie', 'canary'] as const;
export type AnimalCandidateId = (typeof animalCandidateIds)[number];

/**
 * Optional approved high-detail 3D asset origin. Large Blender source files
 * are not squeezed into the static host's real 25 MiB/file limit.
 * This is only a URL resolver; no uploads, billing, or external API calls.
 * The host must allow CORS, HTTPS and serve the exact review-approved GLBs.
 */
const modelOrigin = process.env.NEXT_PUBLIC_MYPETS_3D_ASSET_ORIGIN?.replace(/\/+$/, '') ?? '';
function modelUrl(path: string): string {
  return modelOrigin.startsWith('https://') ? modelOrigin + path : path;
}

/** A distinct, opt-in unapproved GLB candidate for every supplied original. */
export function candidateModelUrl(id: AnimalCandidateId): string {
  return modelUrl(
    id === 'cat'
      ? '/models/candidates/nuzzle-calico-rig.glb'
      : '/models/candidates/species/' + id + '.glb',
  );
}

/** Original video-reference-style chibi GLBs. Always opt-in and unapproved. */
export function chibiCandidateModelUrl(id: AnimalCandidateId): string | null {
  return id === 'cat' || id === 'dog' || id === 'rabbit'
    ? modelUrl('/models/candidates/chibi/' + id + '.glb')
    : null;
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
