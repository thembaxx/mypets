import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { preparePetScene, disposePetScene } from '../lib/pet-scene';

test('scene framing keeps authored mesh transforms intact and grounds all geometry', () => {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 4, 3), new MeshStandardMaterial());
  mesh.position.set(2, 3, -4);
  scene.add(mesh);
  const original = mesh.position.clone();
  const prepared = preparePetScene(scene, Math.PI);
  assert.deepEqual(mesh.position, original);
  const bounds = new Box3().setFromObject(prepared, true);
  assert.ok(Math.abs(bounds.min.y) < 0.00001);
  const size = bounds.getSize(new Vector3());
  assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2.3) < 0.00001);
  disposePetScene(scene);
});

test('shared GPU geometry, material and image resources are released once per owned scene', () => {
  const scene = new Group();
  const geo = new BoxGeometry();
  const mat = new MeshStandardMaterial();
  let images = 0,
    textures = 0,
    materials = 0,
    geometries = 0;
  const tex = new Texture({ close: () => images++ });
  mat.map = tex;
  tex.addEventListener('dispose', () => textures++);
  mat.addEventListener('dispose', () => materials++);
  geo.addEventListener('dispose', () => geometries++);
  scene.add(new Mesh(geo, mat), new Mesh(geo, mat));
  disposePetScene(scene);
  assert.deepEqual([images, textures, materials, geometries], [1, 1, 1, 1]);
});

test('render quality preserves hardware fidelity and bounds software rasterization work', async () => {
  const { petRenderQuality } = await import('../lib/pet-scene');
  const hardware = petRenderQuality('ANGLE Apple GPU', 920, 600, 3);
  assert.equal(hardware.dpr, 1.75);
  assert.equal(hardware.shadowSize, 1024);
  assert.equal(hardware.software, false);
  const software = petRenderQuality('ANGLE Vulkan SwiftShader Device', 920, 600, 2);
  assert.ok(software.dpr < 1);
  assert.ok(920 * 600 * software.dpr ** 2 <= 180001);
  assert.equal(software.shadowSize, 512);
  assert.equal(software.software, true);
  assert.ok(petRenderQuality('llvmpipe', 390, 568, 1).dpr <= 1);
});
