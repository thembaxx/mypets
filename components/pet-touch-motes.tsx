'use client';

/* oxlint-disable react/immutability -- Shader uniforms are owned by Three.js. */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// A restrained, one-shot petting reaction: does not modify the animal mesh, bones or GLB clips.
export default function PetTouchMotes({
  center,
  radius,
  trigger,
  enabled,
}: {
  center: THREE.Vector3;
  radius: number;
  trigger: number;
  enabled: boolean;
}) {
  const shader = useRef<THREE.ShaderMaterial>(null);
  const age = useRef(9);
  const lastTrigger = useRef(trigger);
  const particles = useMemo(() => {
    const count = 36;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = (i * 0.61803398875) % 1;
      const angle = (i * 2.399963229728653);
      const spread = radius * (0.26 + 0.32 * t);
      positions[i * 3] = center.x + Math.cos(angle) * spread;
      positions[i * 3 + 1] = center.y + radius * (0.08 + 0.58 * ((i * 0.754877666) % 1));
      positions[i * 3 + 2] = center.z + Math.sin(angle) * spread;
      phases[i] = t;
    }
    return { positions, phases };
  }, [center, radius]);
  const uniforms = useMemo(() => ({
    uAge: { value: 9 },
    uOpacity: { value: 0 },
  }), []);
  useFrame((_, delta) => {
    const material = shader.current;
    if (!material) return;
    if (lastTrigger.current !== trigger) {
      lastTrigger.current = trigger;
      age.current = 0;
    }
    if (enabled) age.current += Math.min(delta, 0.05);
    material.uniforms.uAge.value = age.current;
    material.uniforms.uOpacity.value = enabled && age.current < 1 ? 0.32 : 0;
  });
  return (
    <points frustumCulled={false} raycast={() => {}}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[particles.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={shader}
        uniforms={uniforms}
        vertexShader={`
          uniform float uAge;
          attribute float aPhase;
          varying float vFade;
          void main() {
            float localAge = max(0.0, uAge - aPhase * 0.24);
            float t = clamp(localAge / 0.72, 0.0, 1.0);
            vec3 p = position;
            p.y += 0.28 * t;
            p.x += sin(aPhase * 17.0) * 0.10 * t;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = 1.5 + aPhase * 2.2;
            vFade = sin(t * 3.14159265);
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          varying float vFade;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float soft = 1.0 - smoothstep(0.08, 0.5, d);
            gl_FragColor = vec4(0.82, 0.73, 0.60, soft * vFade * uOpacity);
            #include <colorspace_fragment>
          }
        `}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}
