/** Optional tactile confirmation on browsers that expose the Vibration API.
 * iOS Safari does not expose this API; visual feedback remains authoritative.
 * Call only from a trusted, explicit user gesture, never on page load.
 */
export type HapticIntent = 'select' | 'confirm';
export function hapticPattern(intent: HapticIntent): number | number[] {
  return intent === 'confirm' ? [12, 24, 18] : 12;
}

export function requestHaptic(intent: HapticIntent = 'select'): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return false;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    return false;
  if (typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate(hapticPattern(intent));
}
