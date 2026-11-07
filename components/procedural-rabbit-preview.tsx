'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import { createProceduralRabbit, disposeProceduralRabbit, setProceduralRabbitPose, type ProceduralRabbitPose } from '@/lib/procedural-animal';

const poses: { id: ProceduralRabbitPose; label: string }[] = [
  { id: 'idle', label: 'Idle' }, { id: 'walk', label: 'Walk' }, { id: 'hop', label: 'Hop' },
  { id: 'sit', label: 'Sit' }, { id: 'lie', label: 'Lie down' }, { id: 'sleep', label: 'Sleep' },
  { id: 'happy', label: 'Happy' }, { id: 'sad', label: 'Sad' }, { id: 'play', label: 'Play' }, { id: 'pet', label: 'Pet reaction' },
];

function RabbitModel({ pose }: { pose: ProceduralRabbitPose }) {
  const reducedMotion = useReducedMotion();
  const rabbit = useMemo(() => createProceduralRabbit(), []);
  useFrame(({ clock }) => setProceduralRabbitPose(rabbit, pose, reducedMotion ? 0 : clock.elapsedTime));
  useEffect(() => () => disposeProceduralRabbit(rabbit), [rabbit]);
  return <primitive object={rabbit} />;
}

/** Code-native reference study; it never downloads or invokes a Blender asset. */
export default function ProceduralRabbitPreview() {
  const [pose, setPose] = useState<ProceduralRabbitPose>('idle');
  return (
    <section className="procedural-rabbit-preview" aria-labelledby="procedural-rabbit-title">
      <div className="procedural-rabbit-preview__heading">
        <p className="cat-lab-eyebrow">Three.js procedural study</p>
        <h2 id="procedural-rabbit-title">Blender-free rabbit prototype</h2>
        <p>Named anatomical parts and deterministic poses, generated directly from Three.js geometry.</p>
      </div>
      <div className="procedural-rabbit-preview__stage" style={{ height: 320, overflow: "hidden", borderRadius: 24 }}>
        <Canvas camera={{ position: [0, 1.65, 4.8], fov: 36 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'low-power' }}>
          <color attach="background" args={['#e9e7e1']} />
          <ambientLight intensity={1.15} />
          <directionalLight position={[-3, 5, 4]} intensity={2.3} castShadow />
          <directionalLight position={[3, 1, -3]} intensity={1.1} color="#d8b9b1" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <circleGeometry args={[2.8, 64]} />
            <meshStandardMaterial color="#d8d3ca" roughness={0.94} />
          </mesh>
          <RabbitModel pose={pose} />
        </Canvas>
      </div>
      <div className="procedural-rabbit-preview__poses" role="group" aria-label="Rabbit pose">
        {poses.map((item) => (
          <button key={item.id} type="button" aria-pressed={pose === item.id} onClick={() => setPose(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
