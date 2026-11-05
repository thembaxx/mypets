import type { CatActivity, CatMood } from './cat-motion';

/** Soft, deterministic eyelid pulses avoid abrupt mechanical snap-blinks. */
export function petBlinkAt(seconds: number): number {
  const phase = Math.max(0, seconds) % 4.7;
  const pulse = (time: number, duration: number) =>
    time >= 0 && time < duration ? Math.sin((Math.PI * time) / duration) ** 2 : 0;
  const cycle = Math.floor(Math.max(0, seconds) / 4.7);
  const doubleBlink = cycle % 3 === 1 ? 0.7 * pulse(phase - 0.31, 0.18) : 0;
  return Math.max(pulse(phase, 0.24), doubleBlink);
}

/**
 * Drive only morph targets that actually exist in a GLB.
 * Unrecognized or authored non-facial targets are left untouched.
 * Expressions are visual accents, not substitutes for a facial rig.
 */
export function petFacialMorphTarget(
  name: string,
  activity: CatActivity,
  mood: CatMood,
  seconds: number,
): number | null {
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const celebrating = activity === 'play' && mood === 'happy';
  const feeding = activity === 'eat' || activity === 'groom';
  const chew = feeding ? Math.max(0, Math.sin(t * 10.5)) ** 2 : 0;
  const lick = feeding ? Math.max(0, Math.sin(t * 9.4)) ** 4 : 0;
  const sniff = activity === 'sniff' ? 0.32 + 0.2 * Math.sin(t * 8) : 0;

  if (/blink|eye.?close/i.test(name))
    return Math.max(
      petBlinkAt(t),
      activity === 'rest' ? 0.9 : mood === 'sleepy' ? 0.7 : celebrating ? 0.28 : 0,
    );
  if (/jaw.?open|mouth.?open/i.test(name))
    return Math.max(feeding ? 0.08 + 0.74 * chew : 0, celebrating ? 0.48 : 0);
  if (/tongue|lick/i.test(name)) return feeding ? lick * 0.82 : 0;
  if (/sniff|nose.?flare/i.test(name)) return sniff;
  if (/whisker.*forward/i.test(name)) return activity === 'sniff' ? 0.4 : 0;
  if (/cheek.?puff/i.test(name))
    return activity === 'groom' ? 0.24 : celebrating ? 0.55 : mood === 'happy' ? 0.18 : 0;
  if (/eye.?wide/i.test(name)) return mood === 'curious' && activity !== 'rest' ? 0.85 : 0;
  if (/smile|happy/i.test(name)) return mood === 'happy' ? (celebrating ? 0.94 : 0.68) : 0;
  if (/ears?.?back|fear|angry/i.test(name)) return 0;
  return null;
}
