'use client';

import { Component, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  AnimationMixer,
  Box3,
  LoopRepeat,
  Mesh,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  XIcon,
  FootprintsIcon,
  ForkKnifeIcon,
  HeartIcon,
  MoonIcon,
  EyeIcon,
  PauseIcon,
  PlayIcon,
  VideoCameraIcon,
} from '@phosphor-icons/react';
import { AnimalAnimationContext } from './shared';
import LivingCat from './living-cat';
import { catMoods, type CatActivity, type CatMood } from '@/lib/cat-motion';

type ModelReport = { clips: string[]; morphs: string[] };
const clipNames: Record<CatActivity, RegExp> = {
  idle: /idle|stand|breath|sit/i,
  walk: /walk|gait|locomotion|trot/i,
  eat: /eat|feed|chew|lick|bite/i,
  play: /play|jump|pounce|paw|run/i,
  rest: /rest|sleep|lie|lay|curl/i,
};

export function findPetClip(names: string[], activity: CatActivity): string | null {
  return names.find((name) => clipNames[activity].test(name)) ?? null;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="tripo-error" role="alert">
          <strong>This 3D model could not be opened.</strong>
          <span>Nothing has changed in your pet collection or original artwork.</span>
          <button type="button" onClick={this.props.onClose}>
            Return to pets
          </button>
        </div>
      );
    return this.props.children;
  }
}

// Engine-owned morph weights are deliberately mutated outside React's state model.
function updateMeshMorph(mesh: Mesh | SkinnedMesh, index: number, target: number, dt: number) {
  const influences = mesh.morphTargetInfluences;
  if (!influences) return;
  influences[index] += (target - influences[index]) * Math.min(1, dt * 12);
}

function AnimalModel({
  url,
  activity,
  mood,
  animated,
  onReport,
}: {
  url: string;
  activity: CatActivity;
  mood: CatMood;
  animated: boolean;
  onReport: (report: ModelReport) => void;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const model = useMemo(() => {
    // SkeletonUtils.clone avoids accidental shared animation bone transforms.
    const copy = clone(gltf.scene);
    const bounds = new Box3().setFromObject(copy);
    const dimensions = bounds.getSize(new Vector3());
    const size = Math.max(dimensions.x, dimensions.y, dimensions.z, 0.001);
    copy.scale.multiplyScalar(2.4 / size);
    const normalized = new Box3().setFromObject(copy);
    const centre = normalized.getCenter(new Vector3());
    copy.position.x -= centre.x;
    copy.position.y -= normalized.min.y;
    copy.position.z -= centre.z;
    return copy;
  }, [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const running = useRef<AnimationAction | null>(null);
  const morphTargets = useMemo(() => {
    const targets: { mesh: Mesh | SkinnedMesh; index: number; name: string }[] = [];
    model.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof SkinnedMesh)) return;
      const dictionary = object.morphTargetDictionary;
      if (!dictionary || !object.morphTargetInfluences) return;
      for (const [name, index] of Object.entries(dictionary))
        targets.push({ mesh: object, index, name });
    });
    return targets;
  }, [model]);
  const morphTargetsRef = useRef(morphTargets);
  useEffect(() => {
    morphTargetsRef.current = morphTargets;
  }, [morphTargets]);
  useEffect(() => {
    onReport({
      clips: gltf.animations.map((clip) => clip.name),
      morphs: morphTargets.map((target) => target.name),
    });
  }, [gltf.animations, morphTargets, onReport]);
  useEffect(() => {
    if (!animated || !gltf.animations.length) {
      running.current?.stop();
      running.current = null;
      return;
    }
    const names = gltf.animations.map((clip) => clip.name);
    const chosen = findPetClip(names, activity) ?? findPetClip(names, 'idle');
    const clip = chosen
      ? gltf.animations.find((candidate) => candidate.name === chosen)
      : activity === 'idle'
        ? gltf.animations[0]
        : null;
    if (!clip) {
      running.current?.stop();
      running.current = null;
      return;
    }
    const next = mixer.clipAction(clip);
    if (running.current && running.current !== next) running.current.fadeOut(0.3);
    next.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.3).play();
    running.current = next;
    return () => {
      next.fadeOut(0.2);
    };
  }, [activity, animated, gltf.animations, mixer]);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
    [mixer, model],
  );
  useFrame((state, delta) => {
    if (!animated) return;
    const dt = Math.min(delta, 0.05);
    mixer.update(dt);
    // Only animate morphs that actually exist on the authored model.
    // Body motion cannot be invented from an unrigged, static photograph.
    const blink = state.clock.elapsedTime % 4.1 < 0.14 ? 1 : 0;
    const chew = activity === 'eat' ? Math.max(0, Math.sin(state.clock.elapsedTime * 10)) : 0;
    for (const { mesh, index, name } of morphTargetsRef.current) {
      const influences = mesh.morphTargetInfluences;
      if (!influences) continue;
      const target = /blink|eye.?close/i.test(name)
        ? mood === 'sleepy'
          ? 0.65
          : blink
        : /jaw.?open|mouth.?open/i.test(name)
          ? chew * 0.8
          : /smile|happy/i.test(name)
            ? mood === 'happy'
              ? 0.7
              : 0
            : /ears?.?back|fear|angry/i.test(name)
              ? 0
              : null;
      if (target !== null) updateMeshMorph(mesh, index, target, dt);
    }
  });
  return <primitive object={model} dispose={null} />;
}

function PetOrbit({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useMemo(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = !reducedMotion;
    orbit.enablePan = false;
    orbit.target.set(0, 0.91, 0);
    orbit.minDistance = 2.7;
    orbit.maxDistance = 7;
    orbit.maxPolarAngle = Math.PI / 2.06;
    orbit.update();
    return orbit;
  }, [camera, gl, reducedMotion]);
  useEffect(() => {
    const repaint = () => invalidate();
    controls.addEventListener('change', repaint);
    return () => {
      controls.removeEventListener('change', repaint);
      controls.dispose();
    };
  }, [controls, invalidate]);
  useFrame(() => controls.update());
  return null;
}

const actions = [
  { activity: 'idle', label: 'Breathe', Icon: HeartIcon },
  { activity: 'walk', label: 'Walk', Icon: FootprintsIcon },
  { activity: 'eat', label: 'Eat', Icon: ForkKnifeIcon },
  { activity: 'play', label: 'Play', Icon: HeartIcon },
  { activity: 'rest', label: 'Rest', Icon: MoonIcon },
] as const;

export default function TripoPet({
  url,
  name,
  onClose,
}: {
  url?: string;
  name: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const animationEnabled = useContext(AnimalAnimationContext);
  const systemReduced = !!useReducedMotion();
  const [activity, setActivity] = useState<CatActivity>('idle');
  const [mood, setMood] = useState<CatMood>('happy');
  const [paused, setPaused] = useState(false);
  const [report, setReport] = useState<ModelReport | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState('');
  const reduced = systemReduced || !animationEnabled || paused;
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      active?.focus();
    };
  }, [onClose]);
  useEffect(
    () => () => {
      if (recordTimeout.current) clearTimeout(recordTimeout.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    },
    [],
  );
  const recordClip = () => {
    if (reduced || recording) return;
    const canvas = canvasRef.current;
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') {
      setRecordError(
        'Video recording is not supported by this browser. Live 3D animation is still available.',
      );
      return;
    }
    try {
      const format = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm'].find(
        (mime) => MediaRecorder.isTypeSupported(mime),
      );
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, format ? { mimeType: format } : undefined);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () =>
        setRecordError('Recording failed. Try the live 3D controls instead.');
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (recordTimeout.current) clearTimeout(recordTimeout.current);
        if (!chunks.length) {
          setRecordError('The browser could not capture frames from the 3D canvas.');
          return;
        }
        const type = recorder.mimeType || 'video/webm';
        const extension = type.includes('mp4') ? 'mp4' : 'webm';
        const file = new Blob(chunks, { type });
        const objectUrl = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'mypets-cat-feeding.' + extension;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      };
      setRecordError('');
      setActivity('eat');
      recorder.start(250);
      setRecording(true);
      recordTimeout.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 8000);
    } catch {
      setRecording(false);
      setRecordError('This device could not start a 3D video recording.');
    }
  };
  const supportedAction =
    !url || activity === 'idle' || (report !== null && !!findPetClip(report.clips, activity));
  const status = url
    ? !report
      ? 'Loading the approved 3D model.'
      : supportedAction
        ? 'Playing an authored 3D animation when available.'
        : 'This model has no ' + activity + ' animation. Showing its idle pose.'
    : 'Original 3D calico study. The illustrated pet remains unchanged.';
  return createPortal(
    <div
      className="tripo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={name + ' interactive 3D studio'}
    >
      <button
        type="button"
        className="tripo-backdrop"
        aria-label="Close 3D studio"
        onClick={onClose}
      />
      <div className="tripo-dialog tripo-living-dialog">
        <div className="tripo-heading">
          <div>
            <strong>{name} · 3D playroom</strong>
            <span>Turn with a finger. Pinch to zoom. Choose what happens next.</span>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="icon-button"
            aria-label="Close 3D studio"
            onClick={onClose}
          >
            <XIcon size={21} />
          </button>
        </div>
        <div className="tripo-living-stage">
          <ModelErrorBoundary onClose={onClose}>
            <Canvas
              frameloop={reduced ? 'demand' : 'always'}
              dpr={[1, 1.6]}
              camera={{ position: [0, 1.25, 4.8], fov: 39 }}
              gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
            >
              <hemisphereLight args={['#fff5e5', '#7b91a1', 1.7]} />
              <ambientLight intensity={0.5} />
              <directionalLight
                position={[-3, 6, 4]}
                intensity={2.4}
                castShadow
                shadow-mapSize={[1024, 1024]}
              />
              <directionalLight position={[3, 3, -4]} intensity={1.3} color="#d6e6ff" />
              <Suspense fallback={null}>
                {url ? (
                  <AnimalModel
                    url={url}
                    activity={activity}
                    mood={mood}
                    animated={!reduced}
                    onReport={setReport}
                  />
                ) : (
                  <LivingCat activity={activity} mood={mood} paused={reduced} />
                )}
              </Suspense>
              <PetOrbit reducedMotion={reduced} />
            </Canvas>
          </ModelErrorBoundary>
        </div>
        <div className="tripo-living-controls">
          <div className="tripo-activity-picker" role="group" aria-label="Animal behaviour">
            {actions.map(({ activity: next, label, Icon }) => (
              <button
                key={next}
                type="button"
                aria-pressed={activity === next}
                className={activity === next ? 'active' : ''}
                onClick={() => setActivity(next)}
                disabled={recording}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="tripo-living-settings">
            <label>
              <EyeIcon size={18} aria-hidden="true" />
              Expression
              <select
                value={mood}
                onChange={(event) => setMood(event.target.value as CatMood)}
                disabled={recording}
                aria-label="Cat facial expression"
              >
                {catMoods.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="tripo-motion-toggle"
              onClick={() => setPaused((previous) => !previous)}
              disabled={systemReduced || !animationEnabled || recording}
              aria-pressed={paused}
            >
              {reduced ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
              {reduced ? 'Paused' : 'Pause motion'}
            </button>
          </div>
          <div className="tripo-record-row">
            <button
              type="button"
              className="tripo-record-button"
              disabled={reduced || recording}
              onClick={recordClip}
            >
              <VideoCameraIcon size={18} aria-hidden="true" />
              {recording ? 'Recording 8-second feeding clip…' : 'Record feeding video (8s)'}
            </button>
          </div>
          <p className="tripo-living-status" role="status">
            {recordError || status}
          </p>
          {!url && (
            <p className="tripo-living-note">
              This is an articulated 3D character prototype with simulated movement and collisions,
              not a photo-accurate reconstruction, motion capture, or a physically exact animal.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
