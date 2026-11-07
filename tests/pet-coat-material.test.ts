import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshStandardMaterial, type WebGLRenderer } from 'three';
import { createPetCoatMaterial, enhancePetCoatMaterial } from '../lib/pet-coat-material';

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

test('GLB coat enhancement preserves source PBR maps and injects subtle shader detail', () => {
  const source = new MeshStandardMaterial({ color: '#c58b62', roughness: 0.72 });
  const enhanced = enhancePetCoatMaterial(source);
  assert.notEqual(enhanced, source);
  assert.equal(enhanced.color.getHex(), source.color.getHex());
  assert.equal(enhanced.roughness, source.roughness);
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n}',
  } as Parameters<typeof enhanced.onBeforeCompile>[0];
  enhanced.onBeforeCompile(shader, {} as WebGLRenderer);
  assert.match(shader.vertexShader, /vPetCoatPosition/);
  assert.match(shader.fragmentShader, /petCoatNoise/);
  assert.match(shader.fragmentShader, /0.035/);
  enhanced.dispose();
  source.dispose();
});
