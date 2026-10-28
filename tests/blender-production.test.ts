import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Blender paw asset is glTF 2.0, animated and embedded', () => {
  const bytes=readFileSync(new URL('../public/models/original/mypets-paw-blender-candidate.glb',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.ok(bytes.length < 8*1024*1024);
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(json.asset.version,'2.0');
  assert.ok(json.meshes.length>1);
  assert.ok(json.animations.length>=1);
  assert.ok(json.buffers.every((b:{uri?:string})=>!b.uri));
});
test('Blender loader keeps both old assets, procedural fallbacks and PWA cache',()=>{
  const src=readFileSync(new URL('../components/ambient-scene.tsx',import.meta.url),'utf8');
  const pwa=readFileSync(new URL('../scripts/prepare-pwa.mjs',import.meta.url),'utf8');
  const page=readFileSync(new URL('../public/3d-preview.html',import.meta.url),'utf8');
  for(const part of ['mypets-paw-blender-candidate.glb','mypets-paw-charm-animated.glb','mypets-paw-charm.glb']) assert.ok(src.includes(part));
  assert.ok(src.includes('Math.PI / 2'));
  assert.ok(src.includes('useReducedMotion'));
  assert.ok(pwa.includes('mypets-paw-blender-candidate.glb'));
  assert.ok(page.includes('Blender original'));
});