import {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  Skeleton,
  SkinnedMesh,
  Texture,
  Vector3,
} from 'three';

/** Imported scenes are exclusively owned by one viewer; no useLoader cache survives it. */
export function disposePetScene(scene: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  const images = new Set<{ close: () => void }>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const texture of textures) {
    const data: unknown = texture.source.data;
    if (data && typeof data === 'object' && 'close' in data && typeof data.close === 'function')
      images.add(data as { close: () => void });
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

/** Keep authored transforms/skin bindings intact; normalize using an outer group. */
export function preparePetScene(scene: Object3D, orientation = 0): Group {
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object instanceof SkinnedMesh) object.skeleton.update();
  });
  const bounds = new Box3().setFromObject(scene, true);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent <= 0 || bounds.isEmpty())
    throw new Error('This model has no visible animal geometry.');
  const positioned = new Group();
  positioned.add(scene);
  positioned.position.set(-centre.x, -bounds.min.y, -centre.z);
  const scaled = new Group();
  scaled.add(positioned);
  scaled.scale.setScalar(2.3 / extent);
  const oriented = new Group();
  oriented.add(scaled);
  oriented.rotation.y = orientation;
  oriented.updateMatrixWorld(true);
  return oriented;
}
