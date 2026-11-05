'use client';

// Three.js owns mutable camera, scene and animation state outside React.
/* oxlint-disable react/immutability */
// The canvas region is keyboard-operable; application role scopes its arrow-key controls.
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import {
  Component,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import {
  ACESFilmicToneMapping,
  Box3,
  PerspectiveCamera,
  PMREMGenerator,
  Sphere,
  Vector3,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from '@phosphor-icons/react';
import { AnimalAnimationContext } from './shared';
import { readData, STORAGE_KEY } from '@/lib/storage';
import type { PetActivity, PetReplacement } from '@/lib/pet-replacements';
import {
  fitPetCamera,
  PetAnimationController,
  resolvePetClip,
  resolvePetAnimation,
} from '@/lib/pet-animation';
import { disposePetScene, preparePetScene, petRenderQuality } from '@/lib/pet-scene';
import PetTouchMotes from './pet-touch-motes';

const activities: { id: PetActivity; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'move', label: 'Move' },
  { id: 'eat', label: 'Feed' },
  { id: 'play', label: 'Play' },
  { id: 'rest', label: 'Rest' },
  { id: 'touch', label: 'Pet' },
];
type ViewCommand = { type: 'left' | 'right' | 'in' | 'out' | 'reset'; sequence: number };

function IllustrationFallback({ asset, message }: { asset: PetReplacement; message: string }) {
  return (
    <div className="replacement-fallback">
      <img
        src={asset.fallbackIllustration}
        alt={asset.speciesId.replaceAll('-', ' ') + ' illustration'}
      />
      <p role="alert">{message}</p>
    </div>
  );
}

class RenderBoundary extends Component<
  { children: ReactNode; asset: PetReplacement },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <IllustrationFallback
        asset={this.props.asset}
        message="3D is unavailable on this device. Your illustration is still here."
      />
    ) : (
      this.props.children
    );
  }
}

function PetScene({
  gltf,
  asset,
  activity,
  touchSequence,
  enabled,
  command,
  onTouch,
  onReady,
  onDpr,
  onSoftwareRenderer,
  onIdle,
}: {
  gltf: GLTF;
  asset: PetReplacement;
  activity: PetActivity;
  touchSequence: number;
  enabled: boolean;
  command: ViewCommand;
  onTouch: () => void;
  onReady: () => void;
  onDpr: (dpr: number) => void;
  onSoftwareRenderer: (software: boolean) => void;
  onIdle: () => void;
}) {
  const { camera, gl, scene, size, invalidate } = useThree();
  const aquatic = asset.speciesId === 'fish' || asset.speciesId === 'angelfish';
  const rendererName = useMemo(() => {
    const context = gl.getContext();
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return String(
      context.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : context.RENDERER),
    );
  }, [gl]);
  const quality = petRenderQuality(rendererName, size.width, size.height, window.devicePixelRatio);
  useEffect(() => {
    onDpr(quality.dpr);
    onSoftwareRenderer(quality.software);
  }, [quality.dpr, quality.software, onDpr, onSoftwareRenderer]);
  useEffect(() => {
    if (!enabled || !quality.software) return;
    // Bound submissions on CPU rasterizers so interaction is not queued behind continuous frames.
    const timer = window.setInterval(() => invalidate(), 125);
    return () => window.clearInterval(timer);
  }, [enabled, quality.software, invalidate]);

  const prepared = useMemo(
    () => preparePetScene(gltf.scene, asset.orientation),
    [gltf.scene, asset.orientation],
  );
  const sphere = useMemo(
    () => new Box3().setFromObject(prepared, true).getBoundingSphere(new Sphere()),
    [prepared],
  );
  const controller = useMemo(
    () => new PetAnimationController(gltf.scene, gltf.animations, asset.aliases),
    [gltf, asset.aliases],
  );
  const controls = useRef<OrbitControls | null>(null);
  const frameSize = useRef('');
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false;
    orbit.maxPolarAngle = Math.PI * 0.52;
    orbit.target.copy(sphere.center);
    const repaint = () => invalidate();
    orbit.addEventListener('change', repaint);
    controls.current = orbit;
    return () => {
      controls.current = null;
      orbit.removeEventListener('change', repaint);
      orbit.dispose();
    };
  }, [camera, gl, invalidate, sphere]);
  useEffect(() => {
    if (controls.current) controls.current.enableDamping = enabled;
  }, [enabled]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const orbit = controls.current;
    if (!orbit) return;
    const distance = fitPetCamera(sphere.radius, camera.fov, size.width / size.height, 1.18);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 30;
    orbit.minDistance = distance * 0.6;
    orbit.maxDistance = distance * 2;
    const nextSize = size.width + 'x' + size.height;
    const resized = frameSize.current !== nextSize;
    frameSize.current = nextSize;
    if (resized || command.type === 'reset' || command.sequence === 0) {
      camera.position
        .copy(sphere.center)
        .add(new Vector3(0.65, 0.3, 1).normalize().multiplyScalar(distance));
      orbit.target.copy(sphere.center);
    } else if (command.type === 'left' || command.type === 'right') {
      camera.position
        .sub(orbit.target)
        .applyAxisAngle(new Vector3(0, 1, 0), command.type === 'left' ? -0.28 : 0.28)
        .add(orbit.target);
    } else {
      const offset = camera.position.clone().sub(orbit.target);
      offset.setLength(
        Math.max(
          orbit.minDistance,
          Math.min(orbit.maxDistance, offset.length() * (command.type === 'in' ? 0.82 : 1.22)),
        ),
      );
      camera.position.copy(orbit.target).add(offset);
    }
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [camera, command, invalidate, size.width, size.height, sphere]);
  useEffect(() => {
    controller.setEnabled(enabled);
    invalidate();
  }, [controller, enabled, invalidate]);
  useEffect(() => {
    controller.setActivity(activity, activity === 'touch');
    invalidate();
  }, [activity, touchSequence, controller, invalidate]);
  useEffect(() => {
    const finished = () => {
      if (
        activity === 'touch' &&
        resolvePetClip(
          gltf.animations.map((clip) => clip.name),
          'idle',
          asset.aliases,
        )
      )
        onIdle();
    };
    controller.mixer.addEventListener('finished', finished);
    return () => controller.mixer.removeEventListener('finished', finished);
  }, [controller, activity, gltf.animations, asset.aliases, onIdle]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.05);
    const previous = scene.environment;
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.65;
    room.dispose();
    generator.dispose();
    invalidate();
    return () => {
      scene.environment = previous;
      environment.dispose();
    };
  }, [gl, scene, invalidate]);
  useEffect(() => {
    onReady();
  }, [onReady]);
  useFrame((_, delta) => {
    if (enabled) controller.update(Math.min(delta, 0.25));
    controls.current?.update();
  });
  const touch = (event: ThreeEvent<MouseEvent>) => {
    if (
      event.delta > 6 ||
      !resolvePetClip(
        gltf.animations.map((clip) => clip.name),
        'touch',
        asset.aliases,
      )
    )
      return;
    event.stopPropagation();
    onTouch();
  };
  return (
    <>
      <hemisphereLight args={['#fff8ed', '#8c9b9a', 1.1]} />
      <directionalLight
        position={[-3, 6, 5]}
        intensity={2.5}
        castShadow={!aquatic}
        shadow-mapSize={[quality.shadowSize, quality.shadowSize]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-3}
        shadow-normalBias={0.02}
        shadow-bias={-0.00015}
        shadow-radius={3}
      />
      <directionalLight position={[4, 3, -4]} color="#dde8ff" intensity={1.2} />
      <primitive object={prepared} dispose={null} onClick={touch} />
      <PetTouchMotes
        center={sphere.center}
        radius={sphere.radius}
        trigger={touchSequence}
        enabled={enabled}
      />
      {!aquatic && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]} receiveShadow>
          <circleGeometry args={[3.2, 64]} />
          <shadowMaterial transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

/** One owned GLTF, one mixer, and no persistent GPU cache after the dialog closes. */
export default function ReplacementPet({
  asset,
  name,
  onClose,
}: {
  asset: PetReplacement;
  name: string;
  onClose: () => void;
}) {
  const aquatic = asset.speciesId === 'fish' || asset.speciesId === 'angelfish';
  const dialog = useRef<HTMLDialogElement>(null);
  const closeCallback = useRef(onClose);
  const contextEnabled = useContext(AnimalAnimationContext);
  const systemReduced = !!useReducedMotion();
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [failed, setFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [renderDpr, setRenderDpr] = useState<number | [number, number]>([1, 1.75]);
  const [softwareRenderer, setSoftwareRenderer] = useState(false);
  const markReady = useCallback(() => setSceneReady(true), []);
  const contextLossCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => contextLossCleanup.current?.(), []);
  const [activity, setActivity] = useState<PetActivity>('idle');
  const [touchSequence, setTouchSequence] = useState(0);
  const [command, setCommand] = useState<ViewCommand>({ type: 'reset', sequence: 0 });
  const enabled =
    preferenceReady && contextEnabled && savedEnabled && !systemReduced && !paused && visible;
  const names = gltf?.animations.map((clip) => clip.name) ?? [];
  const selectedClip = resolvePetAnimation(names, activity, asset.aliases);
  useEffect(() => {
    closeCallback.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const sync = () => {
      setSavedEnabled(readData()?.animalAnimations !== false);
      setPreferenceReady(true);
    };
    const syncVisibility = () => setVisible(document.visibilityState === 'visible');
    const syncStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) sync();
    };
    sync();
    syncVisibility();
    window.addEventListener('storage', syncStorage);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      window.removeEventListener('storage', syncStorage);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let owned: GLTF | null = null;
    setGltf(null);
    setFailed(false);
    setSceneReady(false);
    setActivity('idle');
    const load = async () => {
      try {
        if (!asset.modelUrl) throw new Error('No replacement is available.');
        const url = new URL(asset.modelUrl, window.location.href);
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok) throw new Error('The model download failed.');
        const data = await response.arrayBuffer();
        abort.signal.throwIfAborted();
        const parsed = await new GLTFLoader().parseAsync(data, new URL('.', url).href);
        if (abort.signal.aborted) {
          disposePetScene(parsed.scene);
          return;
        }
        owned = parsed;
        setGltf(parsed);
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      }
    };
    void load();
    return () => {
      abort.abort();
      contextLossCleanup.current?.();
      contextLossCleanup.current = null;
      if (owned) disposePetScene(owned.scene);
    };
  }, [asset.modelUrl]);
  const changeView = (type: ViewCommand['type']) =>
    setCommand((previous) => ({ type, sequence: previous.sequence + 1 }));
  const touch = () => {
    setActivity('touch');
    setTouchSequence((sequence) => sequence + 1);
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="replacement-dialog"
      aria-label={name + ' interactive 3D pet'}
      onCancel={(event) => {
        event.preventDefault();
        closeCallback.current();
      }}
      data-ready={!!gltf && sceneReady && !failed}
      data-animation-enabled={enabled}
    >
      <div className="replacement-shell">
        <header className="replacement-header">
          <div>
            <p>
              {asset.approval === 'experimental' ? 'Experimental replacement' : 'Your pet in 3D'}
            </p>
            <h2>{name}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close 3D pet"
            onClick={onClose}
            autoFocus
          >
            <XIcon size={22} />
          </button>
        </header>
        <div
          className={'replacement-stage' + (aquatic ? ' replacement-aquatic' : '')}
          role="application"
          tabIndex={0}
          aria-label="Animal view. Arrow keys rotate, plus and minus zoom, Home resets."
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const keys: Record<string, ViewCommand['type']> = {
              ArrowLeft: 'left',
              ArrowRight: 'right',
              '+': 'in',
              '=': 'in',
              '-': 'out',
              Home: 'reset',
            };
            if (keys[event.key]) {
              event.preventDefault();
              changeView(keys[event.key]);
            }
          }}
        >
          {failed ? (
            <IllustrationFallback
              asset={asset}
              message="This model could not be opened. Your illustration is still here."
            />
          ) : gltf ? (
            <RenderBoundary asset={asset}>
              <Canvas
                frameloop={enabled && selectedClip.clip && !softwareRenderer ? 'always' : 'demand'}
                dpr={renderDpr}
                shadows={!aquatic}
                camera={{ position: [0, 1, 5], fov: 38 }}
                gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
                onCreated={({ gl }) => {
                  // Attach before scene effects: context loss can occur during GPU initialization.
                  contextLossCleanup.current?.();
                  const lost = (event: Event) => {
                    event.preventDefault();
                    setFailed(true);
                  };
                  gl.domElement.addEventListener('webglcontextlost', lost);
                  contextLossCleanup.current = () =>
                    gl.domElement.removeEventListener('webglcontextlost', lost);
                  gl.toneMapping = ACESFilmicToneMapping;
                  gl.toneMappingExposure = 1;
                }}
                fallback={
                  <IllustrationFallback
                    asset={asset}
                    message="3D is unavailable on this device. Your illustration is still here."
                  />
                }
              >
                <PetScene
                  gltf={gltf}
                  asset={asset}
                  activity={activity}
                  touchSequence={touchSequence}
                  enabled={enabled && !!selectedClip.clip}
                  command={command}
                  onIdle={() => setActivity('idle')}
                  onTouch={touch}
                  onReady={markReady}
                  onDpr={setRenderDpr}
                  onSoftwareRenderer={setSoftwareRenderer}
                />
              </Canvas>
            </RenderBoundary>
          ) : (
            <div className="replacement-loading" role="status">
              <img src={asset.fallbackIllustration} alt="" />
              <span>Opening your 3D pet…</span>
            </div>
          )}
        </div>
        <footer className="replacement-footer">
          <div className="replacement-view-controls" role="group" aria-label="Inspect the animal">
            <button type="button" aria-label="Rotate left" onClick={() => changeView('left')}>
              <ArrowLeftIcon size={19} />
            </button>
            <button type="button" aria-label="Rotate right" onClick={() => changeView('right')}>
              <ArrowRightIcon size={19} />
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => changeView('in')}>
              <PlusIcon size={19} />
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => changeView('out')}>
              <MinusIcon size={19} />
            </button>
            <button type="button" aria-label="Reset view" onClick={() => changeView('reset')}>
              <ArrowClockwiseIcon size={19} />
            </button>
            <button
              type="button"
              className="replacement-pause"
              disabled={
                !preferenceReady ||
                !contextEnabled ||
                !savedEnabled ||
                systemReduced ||
                !gltf ||
                failed
              }
              aria-label={paused ? 'Resume animations' : 'Pause animations'}
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
          <div className="replacement-activities" role="group" aria-label="Animal activities">
            {activities.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={
                  !gltf || !sceneReady || failed || !resolvePetClip(names, item.id, asset.aliases)
                }
                aria-pressed={activity === item.id}
                title={
                  resolvePetClip(names, item.id, asset.aliases)
                    ? undefined
                    : 'This model has no ' + item.id + ' animation'
                }
                onClick={() => (item.id === 'touch' ? touch() : setActivity(item.id))}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="replacement-status" role="status">
            {failed
              ? 'Showing the original illustration.'
              : !gltf || !sceneReady
                ? 'Loading the 3D model.'
                : !enabled
                  ? 'Animations paused. You can still rotate and zoom.'
                  : selectedClip.clip
                    ? 'Playing ' + selectedClip.clip + '.'
                    : 'This model has no supported idle animation. You can still inspect it.'}
          </p>
          {asset.provenance && (
            <p className="replacement-credit">
              <a href={asset.provenance.sourceUrl} target="_blank" rel="noreferrer">
                {asset.provenance.author}
              </a>
              <span aria-hidden="true"> · </span>
              <a href={asset.provenance.licenseUrl} target="_blank" rel="noreferrer">
                {asset.provenance.license}
              </a>
            </p>
          )}
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
