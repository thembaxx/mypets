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
    // Preserve soft hair coverage without sorting every transparent fur layer.
    // These materials already use core glTF cutouts in the measured runtime derivative.
    if (/fur/i.test(object.name)) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.alphaTest > 0) {
          material.alphaHash = true;
          material.alphaToCoverage = true;
        }
      }
    }
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

/** Full detail on hardware GPUs; reduce framebuffer/shadow work on measured software renderers. */
export function petRenderQuality(
  renderer: string,
  width: number,
  height: number,
  deviceDpr: number,
) {
  const hardwareDpr = Math.min(1.75, Math.max(1, Number.isFinite(deviceDpr) ? deviceDpr : 1));
  const software = /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(renderer);
  if (!software) return { dpr: hardwareDpr, shadowSize: 1024, software: false };
  // The ~180k-pixel mobile stage stayed interactive in software WebGL; wide stages did not.
  const pixels = Math.max(1, width) * Math.max(1, height);
  return {
    dpr: Math.max(0.5, Math.min(1, Math.sqrt(180000 / pixels))),
    shadowSize: 512,
    software: true,
  };
}
