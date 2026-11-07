import { MeshPhysicalMaterial, type ColorRepresentation } from 'three';

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
