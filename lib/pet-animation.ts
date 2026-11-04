import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import type { PetActivity, PetReplacement } from './pet-replacements';

type Aliases = PetReplacement['aliases'];
export type PetAnimationResolution = {
  requested: PetActivity;
  clip: string | null;
  fallback: boolean;
};

/** Namespaces, Blender duplicate suffixes, separators and case are not clip identity. */
export function normalizeAnimationName(name: string): string {
  return (name.split(/[|:]/).at(-1) ?? name)
    .replace(/\.\d{3}$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const defaults: Record<PetActivity, readonly string[]> = {
  idle: ['idle', 'breathing', 'breath', 'stand'],
  move: [
    'walk',
    'walking',
    'run',
    'running',
    'swim',
    'swimming',
    'hop',
    'hopping',
    'slither',
    'fly',
    'flying',
  ],
  eat: ['eat', 'eating', 'feed', 'feeding', 'chew', 'chewing'],
  play: ['play', 'playing', 'pounce', 'jump', 'jumping'],
  rest: ['rest', 'resting', 'sleep', 'sleeping', 'lie down'],
  touch: ['touch', 'react', 'reaction', 'pet', 'petting'],
};

/** Asset aliases are authoritative; absent aliases allow conservative word matching. */
export function resolvePetClip(
  names: readonly string[],
  activity: PetActivity,
  aliases: Aliases = {},
): string | null {
  const candidates = aliases[activity] ?? defaults[activity];
  for (const alias of candidates) {
    const target = normalizeAnimationName(alias);
    if (!target) continue;
    const exact = names.find((name) => normalizeAnimationName(name) === target);
    if (exact) return exact;
  }
  // An explicit list describes this particular asset. Do not invent other support.
  if (aliases[activity] !== undefined) return null;
  for (const alias of candidates) {
    const target = ' ' + normalizeAnimationName(alias) + ' ';
    const found = names.find((name) => (' ' + normalizeAnimationName(name) + ' ').includes(target));
    if (found) return found;
  }
  return null;
}

export function resolvePetAnimation(
  names: readonly string[],
  activity: PetActivity,
  aliases: Aliases = {},
): PetAnimationResolution {
  const clip = resolvePetClip(names, activity, aliases);
  if (clip) return { requested: activity, clip, fallback: false };
  return {
    requested: activity,
    clip: activity === 'idle' ? null : resolvePetClip(names, 'idle', aliases),
    fallback: activity !== 'idle',
  };
}

/** Owns animation state only; the viewer owns and disposes the imported scene resources. */
export class PetAnimationController {
  readonly mixer: AnimationMixer;
  private readonly names: string[];
  private readonly retiring = new Map<AnimationAction, number>();
  private current: AnimationAction | null = null;
  private enabled = true;
  private disposed = false;
  private readonly fadeSeconds = 0.28;

  constructor(
    private readonly model: Object3D,
    private readonly clips: AnimationClip[],
    private readonly aliases: Aliases = {},
  ) {
    this.mixer = new AnimationMixer(model);
    this.names = clips.map((clip) => clip.name);
    this.mixer.addEventListener('finished', this.onFinished);
  }

  get currentClip(): string | null {
    return this.current?.getClip().name ?? null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setActivity(activity: PetActivity, restart = false): PetAnimationResolution {
    const resolution = resolvePetAnimation(this.names, activity, this.aliases);
    if (this.disposed) return resolution;
    const clip = this.clips.find((candidate) => candidate.name === resolution.clip);
    if (!clip) {
      this.mixer.stopAllAction();
      this.retiring.clear();
      this.current = null;
      return resolution;
    }
    const next = this.mixer.clipAction(clip);
    if (!restart && next === this.current && next.isRunning()) return resolution;
    const previous = this.current;
    this.retiring.delete(next);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.clampWhenFinished = activity === 'touch' && !resolution.fallback;
    next.setLoop(next.clampWhenFinished ? LoopOnce : LoopRepeat, Infinity);
    if (previous && previous !== next) {
      previous.fadeOut(this.fadeSeconds);
      this.retiring.set(previous, this.fadeSeconds);
      next.fadeIn(this.fadeSeconds);
    }
    next.play();
    this.current = next;
    // Evaluate the authored starting pose without advancing time, also in still mode.
    this.mixer.update(0);
    return resolution;
  }

  update(delta: number): void {
    if (!this.enabled || this.disposed || !Number.isFinite(delta) || delta <= 0) return;
    // Avoid a huge jump after backgrounding. Viewer visibility also gates its frame loop.
    const step = Math.min(delta, 0.05);
    this.mixer.update(step);
    for (const [action, remaining] of this.retiring) {
      if (remaining <= step) {
        action.stop();
        this.retiring.delete(action);
      } else this.retiring.set(action, remaining - step);
    }
  }

  private readonly onFinished = ({ action }: { action: AnimationAction }): void => {
    if (action !== this.current || this.disposed) return;
    // Touch is a one-shot interaction, then returns to a real idle clip if one exists.
    if (resolvePetClip(this.names, 'idle', this.aliases)) this.setActivity('idle');
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.retiring.clear();
    this.current = null;
  }
}

/** A bounding sphere stays inside both horizontal and vertical perspective frusta. */
export function fitPetCamera(
  radius: number,
  fovDegrees: number,
  aspect: number,
  padding = 1.15,
): number {
  const safeRadius = Math.max(Number.isFinite(radius) ? radius : 0, 0.001);
  const safeAspect = Math.max(Number.isFinite(aspect) ? aspect : 1, 0.01);
  const safeFov = Math.max(1, Math.min(179, Number.isFinite(fovDegrees) ? fovDegrees : 40));
  const verticalHalf = (safeFov * Math.PI) / 360;
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * safeAspect);
  return (safeRadius * Math.max(1, padding)) / Math.sin(Math.min(verticalHalf, horizontalHalf));
}
