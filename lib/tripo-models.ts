// An illustration only gains an on-demand 3D view after a developer approves its GLB.
// Keeping this empty preserves every original WebP exactly as supplied.
import type { Species } from './species';
export type AnimalAsset = Species | 'angelfish' | 'budgie' | 'canary';
export const approvedTripoModels: Partial<Record<AnimalAsset, string>> = {};
