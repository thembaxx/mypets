/**
 * Calculate a perspective-camera distance that contains an animated pet in
 * both axes. The horizontal FOV shrinks on portrait screens, so using only
 * the vertical FOV causes ears, tails and moving paws to leave the frame.
 */
export function fitPetCameraDistance(
  width: number,
  height: number,
  verticalFovDegrees: number,
  halfWidth = 1.65,
  halfHeight = 1.75,
  margin = 1.18,
): number {
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const safeFov = Number.isFinite(verticalFovDegrees)
    ? Math.min(120, Math.max(1, verticalFovDegrees))
    : 39;
  const safeHalfWidth = Number.isFinite(halfWidth) ? Math.max(0.01, halfWidth) : 1.65;
  const safeHalfHeight = Number.isFinite(halfHeight) ? Math.max(0.01, halfHeight) : 1.75;
  const safeMargin = Number.isFinite(margin) ? Math.max(1, margin) : 1.18;
  const verticalHalfFov = (safeFov * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * (safeWidth / safeHeight),
  );
  return (
    Math.max(
      safeHalfHeight / Math.tan(verticalHalfFov),
      safeHalfWidth / Math.tan(horizontalHalfFov),
    ) * safeMargin
  );
}
