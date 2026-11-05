import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Mesh,
  SkinnedMesh,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';

export const BUNNY_ACTIONS = [
  'Idle',
  'Walk',
  'Hop',
  'Sit',
  'LieDown',
  'Sleep',
  'Happy',
  'Sad',
  'Play',
  'PetReaction',
] as const;
export type BunnyAction = (typeof BUNNY_ACTIONS)[number];
export type BunnyEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'sleepy'
  | 'surprised'
  | 'curious'
  | 'affectionate';
export type BunnyTouchRegion = 'head' | 'ear' | 'body' | 'paw';

export const REQUIRED_BUNNY_MORPHS = [
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeWide_L',
  'eyeWide_R',
  'browSad_L',
  'browSad_R',
  'mouthSmile',
  'mouthOpen',
  'mouthFrown',
  'cheekPuff',
  'muzzleRaise_L',
  'muzzleRaise_R',
  'noseScrunch',
] as const;

type MorphName = (typeof REQUIRED_BUNNY_MORPHS)[number];
type MorphBinding = { mesh: Mesh | SkinnedMesh; index: number };
type Preset = Partial<Record<MorphName, number>>;

const PRESETS: Record<BunnyEmotion, Preset> = {
  neutral: {},
  happy: {
    eyeBlink_L: 0.95,
    mouthSmile: 1,
    mouthOpen: 0.8,
    cheekPuff: 0.4,
    muzzleRaise_L: 0.5,
    muzzleRaise_R: 0.5,
  },
  sad: {
    browSad_L: 0.95,
    browSad_R: 0.95,
    mouthFrown: 0.85,
    eyeBlink_L: 0.3,
    eyeBlink_R: 0.3,
  },
  sleepy: { eyeBlink_L: 1, eyeBlink_R: 1, mouthSmile: 0.12 },
  surprised: { eyeWide_L: 1, eyeWide_R: 1, mouthOpen: 0.9 },
  curious: { eyeWide_L: 0.32, eyeWide_R: 0.32, noseScrunch: 0.45 },
  affectionate: {
    eyeBlink_L: 0.42,
    eyeBlink_R: 0.42,
    mouthSmile: 0.72,
    muzzleRaise_L: 0.3,
    muzzleRaise_R: 0.3,
  },
};
const LOOPING = new Set<BunnyAction>(['Idle', 'Walk', 'Sleep']);
const RETURN_TO_IDLE = new Set<BunnyAction>(['Hop', 'Happy', 'Sad', 'Play', 'PetReaction']);

export class BunnyAnimationController {
  readonly mixer: AnimationMixer;
  readonly root: Object3D;
  private readonly clips = new Map<BunnyAction, AnimationClip>();
  private readonly morphs = new Map<MorphName, MorphBinding[]>();
  private active: AnimationAction | null = null;
  private activity: BunnyAction | null = null;
  private nextAction: BunnyAction | null = null;
  private emotion: BunnyEmotion = 'neutral';
  private enabled = true;
  private elapsed = 0;

  constructor(root: Object3D, animations: readonly AnimationClip[]) {
    this.root = root;
    this.mixer = new AnimationMixer(root);
    for (const name of BUNNY_ACTIONS) {
      const clip = animations.find((animation) => animation.name === name);
      if (!clip) throw new Error('Bunny GLB missing required animation: ' + name);
      this.clips.set(name, clip);
    }
    root.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof SkinnedMesh)) return;
      const names = object.morphTargetDictionary;
      if (!names || !object.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(names)) {
        if (!REQUIRED_BUNNY_MORPHS.includes(name as MorphName)) continue;
        const morphName = name as MorphName;
        const bindings = this.morphs.get(morphName) ?? [];
        bindings.push({ mesh: object, index });
        this.morphs.set(morphName, bindings);
      }
    });
    for (const morph of REQUIRED_BUNNY_MORPHS) {
      if (!this.morphs.has(morph)) throw new Error('Bunny GLB missing facial morph: ' + morph);
    }
  }

  get currentAction(): BunnyAction | null {
    return this.activity;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  play(name: BunnyAction) {
    this.nextAction = null;
    if (name === 'Sleep' && this.activity !== 'LieDown' && this.activity !== 'Sleep') {
      this.nextAction = 'Sleep';
      this.switchTo('LieDown');
      return;
    }
    if (name === 'Sleep') this.express('sleepy');
    if (name === 'Happy') this.express('happy');
    if (name === 'Sad') this.express('sad');
    this.switchTo(name);
  }

  private switchTo(name: BunnyAction) {
    if (this.activity === name) return;
    const clip = this.clips.get(name);
    if (!clip) throw new Error('Unknown bunny animation: ' + name);
    const next = this.mixer.clipAction(clip);
    const previous = this.active;
    next.reset();
    next.enabled = true;
    next.paused = false;
    next.setEffectiveWeight(1);
    next.setLoop(LOOPING.has(name) ? LoopRepeat : LoopOnce, LOOPING.has(name) ? Infinity : 1);
    next.clampWhenFinished = !LOOPING.has(name);
    if (previous && previous !== next) {
      next.crossFadeFrom(previous, 0.24, false);
    } else {
      next.fadeIn(0.2);
    }
    next.play();
    this.active = next;
    this.activity = name;
  }

  express(emotion: BunnyEmotion) {
    this.emotion = emotion;
  }

  reactToTouch(region: BunnyTouchRegion) {
    const emotion: BunnyEmotion =
      region === 'head' || region === 'ear'
        ? 'affectionate'
        : region === 'paw'
          ? 'curious'
          : 'happy';
    this.express(emotion);
    this.play('PetReaction');
  }

  update(deltaSeconds: number) {
    if (!this.enabled) return;
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
    this.elapsed += dt;
    this.mixer.update(dt);
    if (this.active && this.activity && !LOOPING.has(this.activity)) {
      if (this.active.time >= this.active.getClip().duration - 0.0001) {
        if (this.nextAction) {
          const queued = this.nextAction;
          this.nextAction = null;
          this.play(queued);
        } else if (RETURN_TO_IDLE.has(this.activity)) {
          this.switchTo('Idle');
        }
      }
    }
    const preset = PRESETS[this.emotion];
    const damping = 1 - Math.exp(-dt * 10);
    for (const name of REQUIRED_BUNNY_MORPHS) {
      const target = Math.max(0, Math.min(1, preset[name] ?? 0));
      for (const { mesh, index } of this.morphs.get(name) ?? []) {
        const values = mesh.morphTargetInfluences;
        if (!values) continue;
        values[index] += (target - values[index]) * damping;
      }
    }
    // Blink as a separate small channel only when the expression does not
    // already control the eyelids; maintain deterministic behaviour per instance.
    if (this.emotion === 'neutral' || this.emotion === 'curious') {
      const phase = this.elapsed % 4.2;
      const blink = phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : 0;
      for (const name of ['eyeBlink_L', 'eyeBlink_R'] as const) {
        for (const { mesh, index } of this.morphs.get(name) ?? []) {
          const values = mesh.morphTargetInfluences;
          if (values) values[index] += (blink - values[index]) * damping;
        }
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.morphs.clear();
  }
}
