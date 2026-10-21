'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { XIcon } from '@phosphor-icons/react';

function AnimalModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const model = useMemo(() => {
    const copy = clone(gltf.scene);
    const bounds = new Box3().setFromObject(copy);
    const dimensions = bounds.getSize(new Vector3());
    const size = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
    copy.scale.multiplyScalar(2.65 / size);
    copy.position.sub(new Box3().setFromObject(copy).getCenter(new Vector3()));
    return copy;
  }, [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  useEffect(() => {
    if (!gltf.animations.length) return;
    const action = mixer.clipAction(gltf.animations[0]);
    action.play();
    return () => {
      action.stop();
      mixer.stopAllAction();
    };
  }, [gltf.animations, mixer]);
  useFrame((_, delta) => mixer.update(Math.min(delta, 0.05)));
  return <primitive object={model} dispose={null} />;
}

function PetOrbit() {
  const { camera, gl } = useThree();
  const controls = useMemo(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.enablePan = false;
    orbit.minDistance = 2.7;
    orbit.maxDistance = 7;
    return orbit;
  }, [camera, gl]);
  useEffect(() => () => controls.dispose(), [controls]);
  useFrame(() => controls.update());
  return null;
}

export default function TripoPet({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      active?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="tripo-viewer" role="dialog" aria-modal="true" aria-label={name + ' in 3D'}>
      <button
        type="button"
        className="tripo-backdrop"
        aria-label="Close 3D view"
        onClick={onClose}
      />
      <div className="tripo-dialog">
        <div className="tripo-heading">
          <div>
            <strong>{name}, from a different angle.</strong>
            <span>Drag to turn. Pinch to zoom.</span>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="icon-button"
            aria-label="Close 3D view"
            onClick={onClose}
          >
            <XIcon size={21} />
          </button>
        </div>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 4.6], fov: 39 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={2} />
          <directionalLight position={[2, 3, 4]} intensity={3} />
          <Suspense fallback={null}>
            <AnimalModel url={url} />
          </Suspense>
          <PetOrbit />
        </Canvas>
      </div>
    </div>,
    document.body,
  );
}
