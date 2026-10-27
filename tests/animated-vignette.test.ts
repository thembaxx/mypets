import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('paw charm animated GLB is embedded, versioned and contains named clips', () => {
  const bytes = readFileSync(new URL('../public/models/original/mypets-paw-charm-animated.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 8 * 1024 * 1024);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(json.asset.version, '2.0');
  assert.deepEqual(json.animations.map((clip: {name: string}) => clip.name), ['Gentle hello', 'Floating heart']);
  assert.ok(json.meshes.length > 0 && json.buffers.every((buffer: {uri?: string}) => !buffer.uri));
});

test('3D fallbacks and motion preference are retained', () => {
  const source = readFileSync(new URL('../components/ambient-scene.tsx', import.meta.url), 'utf8');
  for (const pattern of ['mypets-paw-charm-animated.glb', 'mypets-paw-charm.glb', 'useReducedMotion', 'inViewport']) assert.ok(source.includes(pattern));
});
