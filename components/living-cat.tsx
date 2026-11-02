'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { catPoseAt, type CatActivity, type CatMood } from '@/lib/cat-motion';

/**
 * Original, fully three-dimensional calico character study.
 * The proportions and colours refer to public/animals/cat.webp, not a licensed
 * stock model. Real geometry, independently articulated parts, kinematic gait,
 * chewing and blinking, plus spring-driven tail and gravity-driven play ball.
 * This prototype is NOT a photo-to-mesh reconstruction or veterinary-grade
 * biomechanics simulation.
 */
function Ear({ side }: { side: -1 | 1 }) {
  const colour = side === -1 ? '#eaaa51' : '#744432';
  return (
    <group position={[side * 0.53, 0.56, -0.08]} rotation={[0, 0, -side * 0.2]}>
      <mesh castShadow>
        <coneGeometry args={[0.27, 0.58, 3]} />
        <meshStandardMaterial color={colour} roughness={0.88} />
      </mesh>
      <mesh position={[0, -0.02, 0.035]} scale={[0.7, 0.72, 0.5]}>
        <coneGeometry args={[0.27, 0.58, 3]} />
        <meshStandardMaterial color="#ed989d" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Paw({ rear = false }: { rear?: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, -0.2, 0]} scale={[0.26, 0.42, 0.24]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#fff3d9" roughness={0.86} />
      </mesh>
      <mesh castShadow position={[0, -0.52, 0.12]} scale={[0.29, 0.2, 0.28]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#fff3d9" roughness={0.85} />
      </mesh>
      {rear ? null : (
        <group position={[0, -0.54, 0.38]}>
          <mesh scale={[0.125, 0.105, 0.02]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#efa0a2" roughness={0.92} />
          </mesh>
          {[-0.15, 0, 0.15].map((x) => (
            <mesh key={x} position={[x, 0.115, -0.008]} scale={[0.047, 0.047, 0.017]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color="#efa0a2" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function PlayBall({
  active,
  paused,
}: {
  active: boolean;
  paused: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const velocity = useRef({ x: -0.5, y: 0.5, z: 0 });
  useFrame((_, delta) => {
    if (!mesh.current || paused) return;
    const dt = Math.min(0.033, delta);
    if (!active) {
      mesh.current.position.set(1.28, 0.23, 0.8);
      velocity.current = { x: -0.5, y: 0.5, z: 0 };
      return;
    }
    const ball = mesh.current;
    velocity.current.y -= 9.81 * dt;
    ball.position.x += velocity.current.x * dt;
    ball.position.y += velocity.current.y * dt;
    ball.position.z += velocity.current.z * dt;
    ball.rotation.z -= (velocity.current.x / 0.22) * dt;
    if (ball.position.y < 0.22) {
      ball.position.y = 0.22;
      velocity.current.y = Math.abs(velocity.current.y) > 0.4 ? -velocity.current.y * 0.68 : 0;
      velocity.current.x *= 0.96;
    }
    if (Math.abs(ball.position.x) > 1.45) velocity.current.x *= -0.72;
  });
  return (
    <mesh
      ref={mesh}
      position={[1.28, 0.23, 0.8]}
      castShadow
      onClick={(event) => {
        event.stopPropagation();
        velocity.current = { x: -2, y: 3.2, z: 0 };
      }}
    >
      <sphereGeometry args={[0.22, 24, 16]} />
      <meshStandardMaterial color="#dfa06b" roughness={0.46} metalness={0.02} />
    </mesh>
  );
}

function FeedingBowl() {
  return (
    <group position={[0, 0.12, 1.3]}>
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[0.52, 0.37, 0.23, 40]} />
        <meshStandardMaterial color="#8baf97" metalness={0.08} roughness={0.53} />
      </mesh>
      <mesh position={[0, 0.126, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.025, 40]} />
        <meshStandardMaterial color="#aa754b" roughness={0.91} />
      </mesh>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = index * 2.4;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 0.23, 0.153, Math.cos(angle) * 0.23]}
            scale={[0.09, 0.048, 0.07]}
          >
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={index % 2 ? '#8a5335' : '#c08b57'} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function LivingCat({
  activity,
  mood,
  paused,
}: {
  activity: CatActivity;
  mood: CatMood;
  paused: boolean;
}) {
  const elapsed = useRef(0);
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftFront = useRef<Group>(null);
  const rightFront = useRef<Group>(null);
  const leftRear = useRef<Group>(null);
  const rightRear = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const tailVelocity = useRef(0);
  const mouth = useRef<Mesh>(null);
  const tongue = useRef<Mesh>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);
  const leftLid = useRef<Mesh>(null);
  const rightLid = useRef<Mesh>(null);
  const ears = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!root.current || !head.current || !torso.current) return;
    const dt = Math.min(0.05, delta);
    if (!paused) elapsed.current += dt;
    const p = catPoseAt(activity, mood, paused ? 0 : elapsed.current);
    root.current.position.x = p.x;
    root.current.rotation.y = p.heading;
    torso.current.position.y = p.rise + (activity === 'rest' ? -0.25 : 0);
    torso.current.rotation.z = p.lean;
    torso.current.scale.y = p.breathe;
    head.current.position.y = 1.48 - p.headDrop + p.rise;
    head.current.rotation.x = p.headPitch;
    head.current.rotation.y = p.headYaw;
    if (mouth.current) mouth.current.scale.y = Math.max(0.12, p.jaw / 0.24);
    if (tongue.current) {
      tongue.current.position.y = -0.3 - p.tongue * 0.5;
      tongue.current.scale.y = 0.45 + p.tongue * 3;
    }
    for (const eye of [leftEye.current, rightEye.current]) {
      if (eye) eye.scale.y = Math.max(0.025, p.eyeOpen * (1 - p.blink));
    }
    for (const lid of [leftLid.current, rightLid.current]) {
      if (lid) lid.scale.y = 1 - p.eyeOpen * (1 - p.blink) * 0.5;
    }
    if (ears.current) ears.current.rotation.z = p.earTilt;
    if (leftFront.current) {
      leftFront.current.rotation.x = p.frontPaws[0];
      leftFront.current.position.y = 0.89 + p.pawLift[0];
    }
    if (rightFront.current) {
      rightFront.current.rotation.x = p.frontPaws[1];
      rightFront.current.position.y = 0.89 + p.pawLift[1];
    }
    if (leftRear.current) leftRear.current.rotation.x = p.backPaws[0];
    if (rightRear.current) rightRear.current.rotation.x = p.backPaws[1];
    if (tail.current) {
      const target = p.tail;
      // Critically damped-ish torsion spring, independent of FPS and of the walk cycle.
      const acceleration = (target - tail.current.rotation.z) * 23 - tailVelocity.current * 8;
      tailVelocity.current += acceleration * dt;
      tail.current.rotation.z += tailVelocity.current * dt;
    }
  });
  return (
    <group>
      <group ref={root}>
        <group ref={torso}>
          <mesh position={[0, 0.91, -0.15]} scale={[0.74, 0.73, 0.6]} castShadow receiveShadow>
            <sphereGeometry args={[1, 48, 32]} />
            <meshStandardMaterial color="#fff0d6" roughness={0.85} />
          </mesh>
          <mesh position={[-0.5, 0.94, 0.14]} rotation={[0, 0, 0.3]} scale={[0.23, 0.42, 0.16]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#f4b653" roughness={0.86} />
          </mesh>
          <mesh position={[0.28, 0.69, 0.37]} scale={[0.34, 0.39, 0.14]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#fff6e8" roughness={0.9} />
          </mesh>
        </group>
        <group ref={tail} position={[-0.49, 0.56, -0.5]} rotation={[0.3, 0, -0.3]}>
          <mesh position={[-0.34, 0.06, -0.3]} rotation={[0, 0, -0.7]} scale={[0.23, 0.54, 0.23]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#e9a34a" roughness={0.84} />
          </mesh>
          <mesh position={[-0.62, 0.24, -0.37]} rotation={[0, 0, -0.55]} scale={[0.24, 0.35, 0.22]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#784836" roughness={0.85} />
          </mesh>
        </group>
        <group ref={leftRear} position={[-0.46, 0.6, -0.4]} scale={[0.82, 0.76, 0.85]}>
          <Paw rear />
        </group>
        <group ref={rightRear} position={[0.46, 0.6, -0.4]} scale={[0.82, 0.76, 0.85]}>
          <Paw rear />
        </group>
        <group ref={leftFront} position={[-0.53, 0.89, 0.3]} scale={[0.85, 0.95, 0.85]}>
          <Paw />
        </group>
        <group ref={rightFront} position={[0.53, 0.89, 0.3]} scale={[0.85, 0.95, 0.85]}>
          <Paw />
        </group>
        <group ref={head} position={[0, 1.48, 0.33]}>
          <mesh castShadow receiveShadow scale={[0.84, 0.69, 0.55]}>
            <sphereGeometry args={[1, 48, 32]} />
            <meshStandardMaterial color="#fff4df" roughness={0.86} />
          </mesh>
          {/* The orange-left, chocolate-right calico silhouette is drawn in 3D. */}
          <mesh position={[-0.48, 0.32, 0.22]} rotation={[0, 0, -0.38]} scale={[0.38, 0.36, 0.32]} castShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color="#eeb259" roughness={0.88} />
          </mesh>
          <mesh position={[0.46, 0.24, 0.25]} rotation={[0, 0, 0.35]} scale={[0.4, 0.45, 0.29]} castShadow>
            <sphereGeometry args={[1, 32, 24]} />
            <meshStandardMaterial color="#774937" roughness={0.88} />
          </mesh>
          <group ref={ears}>
            <Ear side={-1} />
            <Ear side={1} />
          </group>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.3, -0.17, 0.51]} scale={[0.18, 0.13, 0.04]}>
                <sphereGeometry args={[1, 20, 16]} />
                <meshStandardMaterial color="#f3b8ab" roughness={0.97} />
              </mesh>
              {/* Happy closed eye and optional curious open pupil. */}
              <mesh
                ref={side === -1 ? leftLid : rightLid}
                position={[side * 0.31, 0.17, 0.5]}
                rotation={[0, 0, side * 0.12]}
              >
                <torusGeometry args={[0.145, 0.038, 9, 24, Math.PI]} />
                <meshStandardMaterial color="#513126" roughness={0.89} />
              </mesh>
              <mesh
                ref={side === -1 ? leftEye : rightEye}
                position={[side * 0.31, 0.12, 0.55]}
                scale={[0.095, 0.06, 0.044]}
              >
                <sphereGeometry args={[1, 20, 16]} />
                <meshStandardMaterial color="#352820" roughness={0.38} />
              </mesh>
              {[-1, 0, 1].map((n) => (
                <mesh
                  key={n}
                  position={[side * (0.68 + Math.abs(n) * 0.02), -0.15 + n * 0.09, 0.27]}
                  rotation={[0, side * -0.6, side * (0.15 + n * 0.15)]}
                  scale={[0.15, 0.016, 0.015]}
                >
                  <sphereGeometry args={[1, 12, 8]} />
                  <meshStandardMaterial color="#6e4233" roughness={0.81} />
                </mesh>
              ))}
            </group>
          ))}
          <mesh position={[-0.17, -0.28, 0.5]} scale={[0.22, 0.16, 0.18]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#fff6e6" roughness={0.91} />
          </mesh>
          <mesh position={[0.17, -0.28, 0.5]} scale={[0.22, 0.16, 0.18]} castShadow>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#fff6e6" roughness={0.91} />
          </mesh>
          <mesh ref={mouth} position={[0, -0.34, 0.52]} scale={[0.22, 0.18, 0.055]}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial color="#883a38" roughness={0.92} />
          </mesh>
          <mesh ref={tongue} position={[0, -0.32, 0.581]} scale={[0.13, 0.09, 0.022]}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color="#ed8485" roughness={0.86} />
          </mesh>
          <mesh position={[0, -0.15, 0.61]} scale={[0.095, 0.065, 0.04]}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color="#ef787a" roughness={0.72} />
          </mesh>
        </group>
      </group>
      {activity === 'eat' && <FeedingBowl />}
      {activity === 'play' && <PlayBall active paused={paused} />}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[2.1, 64]} />
        <meshStandardMaterial color="#f8e9d7" roughness={0.95} />
      </mesh>
    </group>
  );
}
