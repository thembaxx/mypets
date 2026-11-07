import assert from 'node:assert/strict';
import test from 'node:test';
import type { WebGLRenderer } from 'three';
import { createPetCoatMaterial } from '../lib/pet-coat-material';

test('procedural coat material uses a soft physical surface', () => {
  const material = createPetCoatMaterial('#fff0d6', 0.86);
  assert.ok(material.isMeshPhysicalMaterial);
  assert.equal(material.roughness, 0.86);
  assert.equal(material.clearcoat, 0.12);
  material.dispose();
});

test('procedural coat shader injects deterministic micro-surface detail', () => {
  const material = createPetCoatMaterial('#fff4df');
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n}',
  } as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  assert.match(shader.vertexShader, /vPetCoatPosition/);
  assert.match(shader.fragmentShader, /petCoatGrain/);
  assert.match(shader.fragmentShader, /petCoatDetail/);
  material.dispose();
});
