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

Object.assign(petReplacements, {
  cat: {
    ...missing('cat'),
    modelId: 'kenchoo-bicolor-cat-2024',
    modelUrl: '/models/replacements/cat.glb',
    visualStyle: 'Textured realistic short-haired cat',
    provenance: {
      sourceUrl: 'https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf',
      downloadUrl: 'https://raw.githubusercontent.com/code4fukui/vr-cats/main/bicolor_cat.glb',
      author: 'kenchoo; base model by guillaume bolis',
      license: 'CC-BY-4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      attribution:
        'Bicolor Cat by kenchoo, based on “3d modelling my cat: Fripouille” (https://skfb.ly/6TKqH) by guillaume bolis, both CC BY 4.0.',
      modifications:
        'Unmodified GLB; separate imported Blender project provided. See full credit record.',
    },
    clips: ['Animation'],
    aliases: { idle: ['Animation'], move: [], eat: [], play: [], rest: [], touch: [] },
    capabilities: ['skeletal idle', 'head and tail motion'],
    approval: 'experimental',
    review: {
      licenseVerified: true,
      structureVerified: true,
      visualVerified: false,
      browserVerified: false,
    },
    performance: {
      bytes: 2297972,
      sha256: '4b395ba943d647f4c490c982a70fa2175ef91569615773da7ef3429e427ed21a',
    },
  },
  rabbit: {
    ...missing('rabbit'),
    modelId: 'cdmir-rabbit-pbr-2026',
    modelUrl: '/models/replacements/rabbit.glb',
    visualStyle: 'Textured natural rabbit',
    provenance: {
      sourceUrl: 'https://opengameart.org/content/rabbit-0',
      downloadUrl: 'https://opengameart.org/sites/default/files/rabbit.blend',
      author: 'CDmir; collaborator TinyWorlds',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution:
        'Rabbit by CDmir, collaborator TinyWorlds, OpenGameArt, CC0. Credit is voluntary.',
      modifications:
        'Converted legacy materials to Principled PBR; removed coarse fur cards; retained normal map and four original skeletal clips; excluded death/bind actions. Original master retained.',
    },
    clips: ['Guarding', 'Jump', 'Running', 'Sitting.000'],
    aliases: {
      idle: ['Guarding'],
      move: ['Running'],
      play: ['Jump'],
      rest: ['Sitting.000'],
      eat: [],
      touch: [],
    },
    capabilities: ['guarding', 'running', 'jumping', 'sitting'],
    approval: 'experimental',
    review: {
      licenseVerified: true,
      structureVerified: true,
      visualVerified: false,
      browserVerified: false,
    },
    performance: {
      bytes: 2788588,
      sha256: '756f5b686288acdbbc62542dbdc0e422f82f6918286ce96af67cbcd3f46f708c',
    },
  },
  bird: {
    ...missing('bird'),
    modelId: 'grab3d-robin-limited-rig-2026',
    modelUrl: '/models/replacements/bird.glb',
    visualStyle: 'Detailed AI-assisted European robin',
    provenance: {
      sourceUrl: 'https://grab3d.com/models/animals/bird/',
      downloadUrl: 'https://grab3d.com/dl/bird/bird.glb',
      author: 'Grab3D / Alexander Popov; MyPets limited rig',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution:
        'European robin by Grab3D (Alexander Popov), CC0, AI-assisted Meshy draft cleaned in Blender. MyPets added limited head/chest deformation. Credit voluntary.',
      modifications:
        'Runtime mesh derivative after measured software-renderer timeout, source-resolution textures; custom weighted head/chest rig with Idle and Touch. No locomotion, feeding, wing or flight animation. Full original Blender master retained.',
    },
    clips: ['Idle', 'Touch'],
    aliases: { idle: ['Idle'], touch: ['Touch'], move: [], eat: [], play: [], rest: [] },
    capabilities: ['subtle chest breathing', 'head tilt reaction'],
    approval: 'experimental',
    review: {
      licenseVerified: true,
      structureVerified: true,
      visualVerified: false,
      browserVerified: false,
    },
    performance: {
      bytes: 11192148,
      sha256: '6cab585f5ae6c6055ad422a57e89732d81baffb4a2e1ae29c21db6cfb280023f',
    },
  },
} satisfies Partial<Record<AnimalCandidateId, PetReplacement>>);

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
