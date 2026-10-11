'use client';
import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion, useReducedMotion } from 'motion/react';
import type { Group } from 'three';
function Toys({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  const [active, setActive] = useState(false);
  useFrame(({ clock, pointer }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y += (pointer.x * 0.3 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-pointer.y * 0.2 - group.current.rotation.x) * 0.04;
    if (!reduced) {
      group.current.position.y = Math.sin(t * 0.65) * 0.07;
      group.current.rotation.z = Math.sin(t * 0.4) * 0.04;
    }
  });
  return (
    <group ref={group} onClick={() => setActive(!active)}>
      <mesh position={[1.4, -0.8, 0]} rotation={[0.3, 0.2, 0.1]} scale={active ? 1.18 : 1}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#eebd88" roughness={0.48} />
      </mesh>
      <mesh position={[1.4, -0.8, 0.01]} rotation={[1.3, 0.3, 0.2]}>
        <torusGeometry args={[0.4, 0.032, 12, 48]} />
        <meshStandardMaterial color="#f9e7d2" />
      </mesh>
      <mesh position={[-1.45, 0.75, -1]} rotation={[0.5, 0.3, 1.3]}>
        <torusGeometry args={[0.32, 0.095, 16, 40]} />
        <meshStandardMaterial color="#9aaf85" roughness={0.8} />
      </mesh>
      <mesh position={[1.9, 1.2, -1]} rotation={[0.5, 0.3, 1.3]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color="#fff3d6" />
      </mesh>
    </group>
  );
}
export default function AmbientScene() {
  const reduced = !!useReducedMotion();
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setSupported(!!context);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
  }, []);
  if (!supported)
    return (
      <div className="scene-fallback" aria-hidden="true">
        <motion.span
          animate={reduced ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>
    );
  return (
    <div className="ambient-canvas" role="img" aria-label="Subtle interactive 3D ball and ring">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={reduced ? 'demand' : 'always'}
      >
        <ambientLight intensity={2} />
        <directionalLight position={[3, 4, 4]} intensity={3} />
        <Suspense fallback={null}>
          <Toys reduced={reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
