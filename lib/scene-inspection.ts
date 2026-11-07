import * as THREE from "three";

export interface SceneInspectionOptions {
  /** Distance between adjacent parts after full separation. */
  gap?: number;
  /** Multiplier applied to each part's bounding-sphere radius. */
  radiusMultiplier?: number;
  /** Names of direct children that must remain fixed. */
  pinnedNames?: readonly string[];
  /** Optional predicate for excluding parts from the exploded layout. */
  exclude?: (part: THREE.Object3D) => boolean;
}

export interface SceneInspectionController {
  /** Deterministic 0..1 separation; safe to call from a scrubber or animation timeline. */
  setProgress(progress: number): void;
  /** Restore every captured transform and release retained references. */
  dispose(restore?: boolean): void;
}

interface PartTransform {
  object: THREE.Object3D;
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * Creates a reversible exploded view for authored, non-deforming scene assemblies.
 *
 * Use semantic top-level groups (for example, building wings, cookware parts,
 * atom shells, turntable components). Do not apply this to skinned meshes or
 * arbitrary children of an animated character; those require a rig-aware layout.
 * The function does not create geometry, alter materials, or own GPU resources.
 */
export function createSceneInspectionController(
  root: THREE.Object3D,
  options: SceneInspectionOptions = {},
): SceneInspectionController {
  const gap = Math.max(0, options.gap ?? 0.12);
  const radiusMultiplier = Math.max(0, options.radiusMultiplier ?? 0.85);
  const pinned = new Set(options.pinnedNames ?? []);
  root.updateMatrixWorld(true);

  const parts: PartTransform[] = [];
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const partCenter = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const fallback = new THREE.Vector3();

  bounds.setFromObject(root);
  if (bounds.isEmpty()) {
    return { setProgress() {}, dispose() {} };
  }
  bounds.getCenter(center);
  root.worldToLocal(center);

  root.children.forEach((object, index) => {
    if (pinned.has(object.name) || options.exclude?.(object)) return;
    if (object instanceof THREE.SkinnedMesh || object.getObjectByProperty("isSkinnedMesh", true))
      return;

    const partBounds = new THREE.Box3().setFromObject(object);
    if (partBounds.isEmpty()) return;
    partBounds.getCenter(partCenter);
    root.worldToLocal(partCenter);
    direction.subVectors(partCenter, center);
    if (direction.lengthSq() < 1e-8) {
      const angle = (index / Math.max(1, root.children.length)) * Math.PI * 2;
      fallback.set(Math.cos(angle), 0.35, Math.sin(angle));
      direction.copy(fallback);
    }
    direction.normalize();

    const sphere = partBounds.getBoundingSphere(new THREE.Sphere());
    const distance = sphere.radius * radiusMultiplier + gap;
    parts.push({
      object,
      position: object.position.clone(),
      target: object.position.clone().addScaledVector(direction, distance),
    });
  });

  let disposed = false;
  return {
    setProgress(progress: number) {
      if (disposed) return;
      const amount = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
      for (const part of parts) {
        part.object.position.lerpVectors(part.position, part.target, amount);
      }
      root.updateMatrixWorld(true);
    },
    dispose(restore = true) {
      if (disposed) return;
      if (restore) {
        for (const part of parts) part.object.position.copy(part.position);
        root.updateMatrixWorld(true);
      }
      parts.length = 0;
      disposed = true;
    },
  };
}

/** Pure timeline helper: callers choose when to seek; no timers or hidden RAF loop. */
export function sceneTimelineProgress(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  return THREE.MathUtils.clamp(
    (Number.isFinite(elapsedMs) ? elapsedMs : 0) / durationMs,
    0,
    1,
  );
}
