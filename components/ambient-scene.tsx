'use client';
import { Suspense, useContext, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion, useReducedMotion } from 'motion/react';
import { AnimationMixer, type AnimationClip, type Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimalAnimationContext } from './shared';
function Toys({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  const paw = useRef<Group>(null);
  const [active, setActive] = useState(false);
  const [originalPaw, setOriginalPaw] = useState<{ scene: Group; animations: AnimationClip[]; blender: boolean } | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const sources = ['/models/original/mypets-paw-blender-candidate.glb', '/models/original/mypets-paw-charm-animated.glb', '/models/original/mypets-paw-charm.glb'];
    const load = (index: number) => {
      const path = sources[index];
      loader.load(path, ({ scene, animations }) => {
        if (!cancelled) setOriginalPaw({ scene, animations, blender: path.includes('blender-candidate') });
      }, undefined, () => {
        if (!cancelled && index + 1 < sources.length) load(index + 1);
      });
    };
    load(0);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!originalPaw || reduced || !originalPaw.animations.length) return;
    const mixer = new AnimationMixer(originalPaw.scene);
    originalPaw.animations.forEach(clip => mixer.clipAction(clip).play());
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(originalPaw.scene);
      mixerRef.current = null;
    };
  }, [originalPaw, reduced]);
  useFrame(({ clock, pointer }, delta) => {
    if (!reduced) mixerRef.current?.update(Math.min(delta, 0.05));
    if (!group.current) return;
    if (reduced) {
      group.current.rotation.set(0, 0, 0);
      group.current.position.y = 0;
      if (paw.current) paw.current.rotation.y = 0;
      return;
    }
    const t = clock.getElapsedTime();
    group.current.rotation.y += (pointer.x * 0.3 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-pointer.y * 0.2 - group.current.rotation.x) * 0.04;
    group.current.position.y = Math.sin(t * 0.65) * 0.07;
    group.current.rotation.z = Math.sin(t * 0.4) * 0.04;
    if (paw.current) {
      paw.current.rotation.y = Math.sin(t * 0.48) * 0.2;
      paw.current.position.y = 0.6 + Math.sin(t * 0.8) * 0.08;
    }
  });
  return (
    <group ref={group} onClick={() => setActive(previous => !previous)}>
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
      {/* Original low-poly paw charm, distinct from the approved animal illustrations. */}
      <group ref={paw} position={[-1.55, 0.6, -0.55]} rotation={[-0.2, 0, -0.15]} scale={active ? 1.13 : 1}>
        {originalPaw ? <group rotation={originalPaw.blender ? [Math.PI / 2, 0, 0] : [0, 0, 0]}><primitive object={originalPaw.scene} dispose={null} /></group> : <>
        <mesh castShadow position={[0, -0.16, 0]} scale={[0.5, 0.39, 0.18]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color="#efb58e" roughness={0.73} />
        </mesh>
        {[-0.39, -0.14, 0.14, 0.39].map((x, i) => (
          <mesh key={i} castShadow position={[x, 0.38 - Math.abs(x) * 0.26, 0]} rotation={[0, 0, -x * 0.18]} scale={[0.18, 0.23, 0.14]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#f1c59c' : '#e5a987'} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, -0.16, 0.175]} scale={[0.29, 0.2, 0.03]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#fff3df" roughness={0.84} />
        </mesh>
        </>}
      </group>
      <mesh position={[1.9, 1.2, -1]} rotation={[0.5, 0.3, 1.3]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color="#fff3d6" />
      </mesh>
    </group>
  );
}
export default function AmbientScene() {
  const enabled = useContext(AnimalAnimationContext);
  const reduced = !!useReducedMotion() || !enabled;
  const [supported, setSupported] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!supported || !sceneRef.current) return;
    const element = sceneRef.current;
    let visible = true;
    const refresh = () => setInViewport(visible && document.visibilityState === 'visible');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; refresh(); }, { threshold: 0.02 },
    );
    observer?.observe(element);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', refresh); };
  }, [supported]);
  if (!enabled) return null;
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
    <div ref={sceneRef} className="ambient-canvas" role="img" aria-label="Gently animated 3D toys and a paw charm">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={reduced || !inViewport ? 'demand' : 'always'}
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
