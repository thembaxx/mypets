import { MeshPhysicalMaterial, MeshStandardMaterial, type ColorRepresentation } from 'three';

/**
 * Lightweight, code-authored coat shading for procedural pets.
 * No texture bake, DCC project, external asset, or additional dependency.
 */
export function createPetCoatMaterial(color: ColorRepresentation, roughness = 0.86) {
  const material = new MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.9,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPetCoatPosition;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvPetCoatPosition = position;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vPetCoatPosition;
float petCoatGrain(vec3 p) {
  float broad = sin(dot(p, vec3(31.7, 47.3, 19.1)) + sin(p.y * 13.0) * 1.4);
  float fine = sin(dot(p, vec3(137.1, 89.7, 163.3)) + sin(p.x * 51.0) * 0.7);
  return broad * 0.65 + fine * 0.35;
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float petCoatDetail = petCoatGrain(vPetCoatPosition);
diffuseColor.rgb *= 0.992 + petCoatDetail * 0.008;`,
    );
  };
  material.customProgramCacheKey = () => 'mypets-procedural-coat-v1';
  return material;
}

/**
 * Adds subtle strand-scale tonal breakup to an existing glTF PBR material.
 * Cloning preserves base colour, maps, roughness/metalness maps and skinning;
 * the shader only modulates the already-lit diffuse colour.
 */
export function enhancePetCoatMaterial(source: MeshStandardMaterial) {
  const material = source.clone();
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPetCoatPosition;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvPetCoatPosition = transformed;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vPetCoatPosition;
float petCoatNoise(vec3 p) {
  vec3 cell = floor(p * vec3(92.0, 128.0, 92.0));
  float n = sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453;
  return fract(n) - 0.5;
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float petCoatVariation = petCoatNoise(vPetCoatPosition);
diffuseColor.rgb *= 1.0 + petCoatVariation * 0.035;`,
    );
  };
  material.customProgramCacheKey = () =>
    `${previousKey.call(material)}|mypets-glb-coat-detail-v1`;
  material.needsUpdate = true;
  return material;
}
