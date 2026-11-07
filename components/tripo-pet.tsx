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
  PerspectiveCamera,
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
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { AnimalAnimationContext } from './shared';
import LivingCat, { FeedingBowl } from './living-cat';
import { validateLocalGlb } from '@/lib/validate-local-glb';
import { catMoods, type CatActivity, type CatMood } from '@/lib/cat-motion';
import { petFacialMorphTarget } from '@/lib/pet-face';
import { PetStudioEnvironment } from './pet-studio-environment';
import { fitPetCameraDistance } from '@/lib/pet-camera';

type ModelReport = { url: string; clips: string[]; morphs: string[] };
const clipNames: Record<CatActivity, RegExp> = {
  idle: /idle|stand|breath|sit/i,
  walk: /walk|gait|locomotion|trot/i,
  eat: /eat|feed|chew|lick|bite/i,
  play: /play|jump|pounce|paw|run/i,
  rest: /rest|sleep|lie|lay|curl/i,
  groom: /groom|wash|clean|lick.?paw/i,
  sniff: /sniff|scent|smell/i,
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
    // Imported glTF meshes default to not casting shadows. Real contact
    // shadows expose hovering paws and make the floor interaction reviewable.
    copy.traverse((object) => {
      if (object instanceof Mesh || object instanceof SkinnedMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
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
      url,
      clips: gltf.animations.map((clip) => clip.name),
      morphs: morphTargets.map((target) => target.name),
    });
  }, [gltf.animations, morphTargets, onReport, url]);
  useEffect(() => {
    if (!gltf.animations.length) {
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
  }, [activity, gltf.animations, mixer]);
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
    for (const { mesh, index, name } of morphTargetsRef.current) {
      if (!mesh.morphTargetInfluences) continue;
      const target = petFacialMorphTarget(name, activity, mood, state.clock.elapsedTime);
      if (target !== null) updateMeshMorph(mesh, index, target, dt);
    }
  });
  return <primitive object={model} dispose={null} />;
}

function applyPetCameraFrame(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  width: number,
  height: number,
) {
  const distance = fitPetCameraDistance(width, height, camera.fov);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 24;
  camera.position.set(distance * 0.1, 1.12 + distance * 0.06, distance);
  camera.updateProjectionMatrix();
  controls.target.set(0, 1, 0);
  controls.minDistance = distance * 0.68;
  controls.maxDistance = distance * 2.1;
  controls.update();
}

function PetOrbit({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera, gl, invalidate, size } = useThree();
  const frameSize = useRef('');
  const controls = useMemo(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = !reducedMotion;
    orbit.enablePan = false;
    orbit.target.set(0, 1, 0);
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
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const key = width + 'x' + height;
    if (frameSize.current === key) return;
    frameSize.current = key;

    // Fit both axes: portrait canvases have a much narrower horizontal FOV,
    // while ears, tail and playful poses need a little breathing room.
    applyPetCameraFrame(camera, controls, width, height);
    invalidate();
  }, [camera, controls, invalidate, size.height, size.width]);
  useFrame(() => controls.update());
  return null;
}

const actions = [
  { activity: 'idle', label: 'Breathe', Icon: HeartIcon },
  { activity: 'walk', label: 'Walk', Icon: FootprintsIcon },
  { activity: 'eat', label: 'Eat', Icon: ForkKnifeIcon },
  { activity: 'play', label: 'Play', Icon: HeartIcon },
  { activity: 'rest', label: 'Rest', Icon: MoonIcon },
  { activity: 'groom', label: 'Groom', Icon: HeartIcon },
  { activity: 'sniff', label: 'Sniff', Icon: EyeIcon },
] as const;

export default function TripoPet({
  url,
  name,
  onClose,
  defaultCandidate = false,
  candidateUrl = '/models/candidates/nuzzle-calico-rig.glb',
  allowProceduralCat = true,
}: {
  url?: string;
  name: string;
  onClose: () => void;
  defaultCandidate?: boolean;
  candidateUrl?: string;
  allowProceduralCat?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
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
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [candidateMode, setCandidateMode] = useState(defaultCandidate);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);
  const activeUrl = localPreview ?? (candidateMode ? candidateUrl : url);
  // Sleeping background WebGL views saves GPU/battery on iPhone. Resume the
  // existing mixer position instead of restarting an action on visibility.
  const motionBlocked = systemReduced || !animationEnabled;
  const reduced = motionBlocked || paused || !pageVisible;
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !viewerRef.current) return;
      const root = viewerRef.current;
      const controls = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !root.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
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
  useEffect(
    () => () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    },
    [],
  );
  const loadLocalModel = async (file?: File) => {
    if (!file || recording) return;
    try {
      const contents = await file.arrayBuffer();
      validateLocalGlb(contents);
      const next = URL.createObjectURL(new Blob([contents], { type: 'model/gltf-binary' }));
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = next;
      setLocalPreview(next);
      setPreviewError('');
      setReport(null);
      setActivity('idle');
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Cannot open this GLB.');
    }
  };
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
        link.download =
          'mypets-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-feeding.' + extension;
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
  const currentReport = report?.url === activeUrl ? report : null;
  const namedClip = currentReport ? findPetClip(currentReport.clips, activity) : null;
  const idleClip = currentReport ? findPetClip(currentReport.clips, 'idle') : null;
  const playingClip =
    namedClip ?? idleClip ?? (activity === 'idle' ? currentReport?.clips[0] : null);
  const status = motionBlocked
    ? 'Animations are off in Settings or reduced-motion preferences. Rotation remains available.'
    : paused || !pageVisible
      ? 'Animation is paused. Rotation remains available.'
      : activeUrl
        ? !currentReport
          ? 'Loading the rigged 3D model.'
          : !playingClip
            ? 'This model has no supported ' + activity + ' animation. Showing its current pose.'
            : namedClip || activity === 'idle'
              ? `Playing an authored 3D animation: ${playingClip} (${currentReport.clips.length} clips).`
              : 'This model has no ' + activity + ' animation. Playing ' + playingClip + ' instead.'
        : 'Original 3D calico study. The illustrated pet remains unchanged.';
  return createPortal(
    <div
      ref={viewerRef}
      className="tripo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={name + ' interactive 3D studio'}
    >
      <button
        type="button"
        tabIndex={-1}
        className="tripo-backdrop"
        aria-label="Dismiss 3D studio backdrop"
        onClick={onClose}
      />
      <div className="tripo-dialog tripo-living-dialog">
        <div className="tripo-heading">
          <div>
            <strong>{name} · 3D playroom</strong>
            <span>Drag to rotate · pinch to zoom</span>
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
          <ModelErrorBoundary onClose={onClose} key={activeUrl || 'procedural'}>
            <Canvas
              frameloop={reduced ? 'demand' : 'always'}
              dpr={[1, 1.5]}
              camera={{ position: [0, 1.25, 4.8], fov: 39 }}
              gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
            >
              <PetStudioEnvironment />
              <hemisphereLight args={['#fff5e5', '#7b91a1', 1.7]} />
              <ambientLight intensity={0.5} />
              <directionalLight
                position={[-3, 6, 4]}
                intensity={2.4}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-2.6}
                shadow-camera-right={2.6}
                shadow-camera-top={3}
                shadow-camera-bottom={-2}
                shadow-normalBias={0.015}
              />
              <directionalLight position={[3, 3, -4]} intensity={1.3} color="#d6e6ff" />
              {activeUrl && (
                <group>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
                    <circleGeometry args={[2.1, 64]} />
                    <meshBasicMaterial
                      color="#a08c7a"
                      transparent
                      opacity={0.08}
                      depthWrite={false}
                    />
                  </mesh>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} receiveShadow>
                    <circleGeometry args={[2.1, 64]} />
                    <shadowMaterial transparent opacity={0.28} depthWrite={false} />
                  </mesh>
                </group>
              )}
              <Suspense fallback={null}>
                {activeUrl ? (
                  <group rotation={[0, localPreview || candidateMode ? Math.PI : 0, 0]}>
                    <AnimalModel
                      url={activeUrl}
                      activity={activity}
                      mood={mood}
                      animated={!reduced}
                      onReport={setReport}
                    />
                  </group>
                ) : (
                  <LivingCat activity={activity} mood={mood} paused={reduced} />
                )}
              </Suspense>
              {activeUrl && activity === 'eat' && <FeedingBowl distance={1.05} />}
              <PetOrbit reducedMotion={reduced} />
            </Canvas>
          </ModelErrorBoundary>
        </div>
        <div className="tripo-living-controls">
          {!url && allowProceduralCat && (
            <button
              type="button"
              className="tripo-candidate-toggle"
              disabled={recording}
              onClick={() => {
                setCandidateMode((current) => !current);
                setPreviewError('');
                setReport(null);
                setActivity('idle');
                if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
                localPreviewRef.current = null;
                setLocalPreview(null);
              }}
            >
              {candidateMode
                ? 'Return to original procedural 3D cat'
                : 'Preview rigged Blender cat (experimental)'}
            </button>
          )}
          <label className="tripo-local-file">
            <UploadSimpleIcon size={18} aria-hidden="true" />
            <span>Review a downloaded Blender GLB (on-device only)</span>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              disabled={recording}
              onChange={(event) => {
                const file = event.target.files?.[0];
                void loadLocalModel(file);
                event.target.value = '';
              }}
            />
          </label>
          {previewError && (
            <p className="tripo-living-status" role="alert">
              {previewError}
            </p>
          )}
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
                aria-label={
                  allowProceduralCat ? 'Cat facial expression' : 'Animal facial expression'
                }
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
              disabled={motionBlocked || recording}
              aria-pressed={paused}
            >
              {paused || motionBlocked ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
              {motionBlocked
                ? 'Motion limited by preferences'
                : paused
                  ? 'Resume motion'
                  : 'Pause motion'}
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
          {((candidateMode && !localPreview) || !activeUrl) && (
            <details className="tripo-living-disclosure">
              <summary>About this 3D model</summary>
              {candidateMode && !localPreview && (
                <p className="tripo-living-note">
                  Experimental Blender rig. Compare anatomy and motion with the original
                  illustration before adopting the model.
                </p>
              )}
              {!activeUrl && (
                <p className="tripo-living-note">
                  This articulated 3D prototype simulates movement and collisions. It is not a
                  photo-accurate reconstruction or physically exact animal.
                </p>
              )}
            </details>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
