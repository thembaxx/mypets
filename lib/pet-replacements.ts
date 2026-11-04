import { animalCandidateIds, type AnimalCandidateId } from './species-3d';

export type PetActivity = 'idle' | 'move' | 'eat' | 'play' | 'rest' | 'touch';
export type PetReplacement = {
  speciesId: AnimalCandidateId;
  modelId: string;
  modelUrl: string | null;
  visualStyle: string;
  provenance: {
    sourceUrl: string;
    downloadUrl: string;
    author: string;
    license: string;
    licenseUrl: string;
    attribution: string;
    modifications: string;
  } | null;
  clips: readonly string[];
  aliases: Partial<Record<PetActivity, readonly string[]>>;
  capabilities: readonly string[];
  approval: 'missing' | 'experimental' | 'approved';
  review: {
    licenseVerified: boolean;
    structureVerified: boolean;
    visualVerified: boolean;
    browserVerified: boolean;
  };
  fallbackIllustration: string;
  orientation?: number;
  performance?: { bytes: number; sha256: string };
};

function missing(speciesId: AnimalCandidateId): PetReplacement {
  return {
    speciesId,
    modelId: speciesId + '-pending',
    modelUrl: null,
    visualStyle: 'Pending replacement',
    provenance: null,
    clips: [],
    aliases: {},
    capabilities: [],
    approval: 'missing',
    review: {
      licenseVerified: false,
      structureVerified: false,
      visualVerified: false,
      browserVerified: false,
    },
    fallbackIllustration: '/animals/' + speciesId + '.webp',
  };
}

export const petReplacements: Record<AnimalCandidateId, PetReplacement> = Object.fromEntries(
  animalCandidateIds.map((id) => [id, missing(id)]),
) as Record<AnimalCandidateId, PetReplacement>;

/** Only the explicit replacement preview may display experimental imports. */
export function replacementFor(id: AnimalCandidateId, preview = false): PetReplacement | null {
  const asset = petReplacements[id];
  if (
    !asset.modelUrl ||
    !asset.provenance ||
    !asset.review.licenseVerified ||
    !asset.review.structureVerified
  )
    return null;
  if (asset.approval === 'approved' && asset.review.visualVerified && asset.review.browserVerified)
    return asset;
  return preview && asset.approval === 'experimental' ? asset : null;
}
