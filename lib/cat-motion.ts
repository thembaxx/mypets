/**
 * Deterministic, time-based pose curves for the original calico cat prototype.
 * These are kinematic gestures, not a substitute for captured skeletal motion.
 * All inputs are seconds; every path loops and clamps to the floor.
 */
export type CatActivity = 'idle' | 'walk' | 'eat' | 'play' | 'rest' | 'groom' | 'sniff';
export type CatMood = 'happy' | 'curious' | 'sleepy';
export type CatPose = {
  x: number;
  heading: number;
  rise: number;
  lean: number;
  breathe: number;
  headPitch: number;
  headYaw: number;
  headDrop: number;
  jaw: number;
  tongue: number;
  blink: number;
  eyeOpen: number;
  earTilt: number;
  tail: number;
  frontPaws: [number, number];
  backPaws: [number, number];
  pawLift: [number, number];
};

export const catActivities: readonly CatActivity[] = ['idle', 'walk', 'eat', 'play', 'rest', 'groom', 'sniff'];
export const catMoods: readonly CatMood[] = ['happy', 'curious', 'sleepy'];

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function catPoseAt(activity: CatActivity, mood: CatMood, time: number): CatPose {
  const t = Math.max(0, time);
  const walking = activity === 'walk';
  const eating = activity === 'eat';
  const playing = activity === 'play';
  const resting = activity === 'rest';
  const grooming = activity === 'groom';
  const sniffing = activity === 'sniff';
  const stride = t * 6.8;
  const bite = Math.sin(t * 12);
  const blinkPhase = t % 4.3;
  const naturalBlink = clamp((0.19 - Math.abs(blinkPhase - 0.14)) * 7.2, 0, 1);
  const moodBlink = mood === 'sleepy' ? 0.65 : 0;
  const gaitLeft = walking ? Math.sin(stride) : 0;
  const gaitRight = walking ? Math.sin(stride + Math.PI) : 0;
  return {
    x: walking ? Math.sin(t * 0.54) * 0.65 : 0,
    heading: walking ? (Math.cos(t * 0.54) >= 0 ? 0.6 : -0.6) : 0,
    rise: walking
      ? Math.abs(Math.sin(stride)) * 0.055
      : playing
        ? Math.abs(Math.sin(t * 4)) * 0.07
        : 0,
    lean: walking ? Math.sin(stride) * 0.045 : playing ? Math.sin(t * 5) * 0.07 : grooming ? -0.055 : 0,
    breathe: 1 + Math.sin(t * (resting ? 1.25 : 2.1)) * 0.013,
    headPitch: eating
      ? 0.54 + Math.sin(t * 3.2) * 0.08
      : grooming ? 0.30 + Math.sin(t * 4.1) * 0.045
      : sniffing ? -0.13 + Math.sin(t * 3.3) * 0.07
      : resting
        ? 0.12
        : playing
          ? -0.12
          : Math.sin(t * 0.85) * 0.045,
    headYaw: eating
      ? -0.12 + Math.sin(t * 2.8) * 0.05
      : grooming ? -0.27 + Math.sin(t * 0.9) * 0.045
      : sniffing ? Math.sin(t * 1.5) * 0.22
      : mood === 'curious'
        ? Math.sin(t * 1.1) * 0.2
        : Math.sin(t * 0.55) * 0.07,
    headDrop: eating ? 0.45 : grooming ? 0.15 : sniffing ? 0.07 : resting ? 0.27 : 0,
    jaw: eating ? 0.14 + Math.max(0, bite) * 0.25 : grooming ? 0.05 + Math.max(0, Math.sin(t * 9.1)) * 0.1 : playing ? 0.08 : mood === 'happy' ? 0.055 : 0,
    tongue: eating ? Math.pow(Math.max(0, Math.sin(t * 8)), 3) * 0.21 : grooming ? Math.pow(Math.max(0, Math.sin(t * 9.1)), 3) * 0.17 : 0,
    blink: Math.max(naturalBlink, moodBlink, resting ? 0.9 : 0),
    eyeOpen: sniffing ? 0.75 : mood === 'curious' && !resting ? 0.8 : playing ? 0.45 : 0.15,
    earTilt: sniffing ? Math.sin(t * 3.4) * 0.13 : mood === 'curious' ? Math.sin(t * 2.1) * 0.1 : eating ? -0.08 : 0,
    tail: Math.sin(t * (playing ? 5 : 1.7)) * (playing ? 0.34 : sniffing ? 0.22 : 0.16),
    frontPaws: [grooming ? -0.62 + Math.sin(t * 4.5) * 0.07 : gaitLeft * 0.48, gaitRight * 0.48],
    backPaws: [gaitRight * 0.39, gaitLeft * 0.39],
    pawLift: [
      walking ? Math.max(0, gaitLeft) * 0.1 : grooming ? 0.36 + Math.sin(t * 4.5) * 0.03 : playing ? 0.22 + Math.sin(t * 5) * 0.14 : 0,
      walking ? Math.max(0, gaitRight) * 0.1 : 0,
    ],
  };
}
