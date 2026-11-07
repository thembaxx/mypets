import * as THREE from 'three';

export type ProceduralRabbitPose =
  | 'idle'
  | 'walk'
  | 'hop'
  | 'sit'
  | 'lie'
  | 'sleep'
  | 'happy'
  | 'sad'
  | 'play'
  | 'pet';

export interface ProceduralRabbitOptions {
  coat?: THREE.ColorRepresentation;
  innerEar?: THREE.ColorRepresentation;
  eye?: THREE.ColorRepresentation;
}

/**
 * Code-native rabbit study for previews and fallback states.
 * It is deliberately assembled from named anatomical groups so each part can be
 * inspected, replaced, or driven by a future image-conditioned mesh without Blender.
 */
export function createProceduralRabbit(options: ProceduralRabbitOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'mypets-procedural-rabbit';
  const coat = new THREE.MeshPhysicalMaterial({
    color: options.coat ?? '#e9dfd2',
    roughness: 0.82,
    metalness: 0,
    sheen: 0.32,
    sheenRoughness: 0.9,
  });
  const inner = new THREE.MeshStandardMaterial({
    color: options.innerEar ?? '#c98f91',
    roughness: 0.92,
  });
  const dark = new THREE.MeshPhysicalMaterial({
    color: options.eye ?? '#241f20',
    roughness: 0.16,
    clearcoat: 1,
  });
  const noseMaterial = new THREE.MeshStandardMaterial({
    color: '#bd8587',
    roughness: 0.62,
  });
  const parts = new Map<string, THREE.Group>();

  const group = (name: string, parent: THREE.Object3D = root) => {
    const value = new THREE.Group();
    value.name = name;
    parent.add(value);
    parts.set(name, value);
    return value;
  };

  const mesh = (
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
  ) => {
    const value = new THREE.Mesh(geometry, material);
    value.name = name;
    value.position.set(...position);
    value.scale.set(...scale);
    value.castShadow = true;
    value.receiveShadow = true;
    parent.add(value);
    return value;
  };

  const body = group('rabbit-body');
  mesh(
    body,
    'torso',
    new THREE.SphereGeometry(0.5, 32, 24),
    coat,
    [0, 0.76, 0],
    [0.58, 0.7, 0.92],
  );
  mesh(
    body,
    'chest',
    new THREE.SphereGeometry(0.34, 28, 20),
    coat,
    [0, 0.94, 0.37],
    [0.74, 0.95, 0.7],
  );
  mesh(
    body,
    'tail',
    new THREE.SphereGeometry(0.2, 24, 18),
    coat,
    [0, 0.72, -0.86],
    [1, 1, 1],
  );

  const head = group('rabbit-head');
  head.position.set(0, 1.47, 0.53);
  mesh(
    head,
    'head-skull',
    new THREE.SphereGeometry(0.39, 32, 24),
    coat,
    [0, 0, 0.08],
    [0.94, 0.92, 0.9],
  );
  mesh(
    head,
    'muzzle-left',
    new THREE.SphereGeometry(0.16, 24, 16),
    coat,
    [-0.12, -0.13, 0.36],
    [1, 0.82, 0.86],
  );
  mesh(
    head,
    'muzzle-right',
    new THREE.SphereGeometry(0.16, 24, 16),
    coat,
    [0.12, -0.13, 0.36],
    [1, 0.82, 0.86],
  );
  mesh(
    head,
    'nose',
    new THREE.SphereGeometry(0.07, 20, 16),
    noseMaterial,
    [0, -0.035, 0.49],
    [1.1, 0.8, 0.8],
  );

  for (const side of [-1, 1]) {
    mesh(
      head,
      side < 0 ? 'eye-left' : 'eye-right',
      new THREE.SphereGeometry(0.055, 20, 16),
      dark,
      [side * 0.235, 0.075, 0.365],
      [0.86, 1.05, 0.58],
    );
    const ear = group(side < 0 ? 'ear-left' : 'ear-right', head);
    ear.position.set(side * 0.19, 0.31, -0.025);
    ear.rotation.z = side * -0.12;
    mesh(
      ear,
      'ear-outer',
      new THREE.SphereGeometry(0.19, 24, 20),
      coat,
      [0, 0.34, 0],
      [0.66, 1.72, 0.34],
    );
    mesh(
      ear,
      'ear-inner',
      new THREE.SphereGeometry(0.145, 24, 20),
      inner,
      [0, 0.35, 0.105],
      [0.62, 1.55, 0.16],
    );
  }

  for (const side of [-1, 1]) {
    const hind = group(side < 0 ? 'hind-leg-left' : 'hind-leg-right');
    hind.position.set(side * 0.34, 0.43, -0.31);
    mesh(
      hind,
      'thigh',
      new THREE.SphereGeometry(0.25, 24, 18),
      coat,
      [0, 0, 0],
      [0.82, 1.05, 1.08],
    );
    mesh(
      hind,
      'hind-paw',
      new THREE.SphereGeometry(0.18, 24, 18),
      coat,
      [0, -0.24, 0.22],
      [0.82, 0.55, 1.4],
    );

    const fore = group(side < 0 ? 'fore-leg-left' : 'fore-leg-right');
    fore.position.set(side * 0.24, 0.48, 0.48);
    mesh(
      fore,
      'forearm',
      new THREE.CapsuleGeometry(0.105, 0.32, 6, 12),
      coat,
      [0, -0.12, 0],
      [0.9, 1, 0.9],
    );
    mesh(
      fore,
      'fore-paw',
      new THREE.SphereGeometry(0.13, 20, 16),
      coat,
      [0, -0.32, 0.08],
      [0.9, 0.55, 1.2],
    );
  }

  root.userData.proceduralParts = parts;
  root.userData.proceduralSource = 'threejs-code-native';
  root.scale.setScalar(1.15);
  return root;
}

/** Deterministic, bounded poses suitable for screenshot capture and timeline scrubbing. */
export function setProceduralRabbitPose(
  root: THREE.Group,
  pose: ProceduralRabbitPose,
  time = 0,
): void {
  const parts = root.userData.proceduralParts as Map<string, THREE.Group> | undefined;
  if (!parts) return;
  const t = Number.isFinite(time) ? time : 0;
  const wave = Math.sin(t * Math.PI * 2);
  const body = parts.get('rabbit-body');
  const head = parts.get('rabbit-head');

  if (body) {
    body.position.y =
      pose === 'hop'
        ? Math.max(0, wave) * 0.48
        : pose === 'walk'
          ? 0.035 + Math.abs(wave) * 0.025
          : pose === 'lie' || pose === 'sleep'
            ? -0.22
            : 0;
    body.rotation.z = pose === 'sad' ? 0.09 : pose === 'happy' ? -0.035 : 0;
  }

  if (head) {
    head.rotation.z =
      pose === 'sad'
        ? 0.16
        : pose === 'happy'
          ? -0.08
          : pose === 'pet'
            ? 0.12 * wave
            : 0.025 * wave;
    head.rotation.x = pose === 'lie' || pose === 'sleep' ? -0.72 : pose === 'play' ? 0.12 : 0;
  }

  for (const [name, part] of parts) {
    if (name.startsWith('ear-')) {
      const side = name.endsWith('left') ? -1 : 1;
      const base = side * -0.12;
      part.rotation.z =
        base +
        (pose === 'sad'
          ? side * -0.22
          : pose === 'happy'
            ? side * 0.16
            : 0.045 * wave);
    } else if (name.startsWith('fore-leg-')) {
      const side = name.endsWith('left') ? 1 : -1;
      part.rotation.x =
        pose === 'hop' || pose === 'play'
          ? 0.5 + 0.15 * wave
          : pose === 'walk'
            ? side * wave * 0.34
            : pose === 'lie' || pose === 'sleep'
              ? -0.8
              : 0;
    } else if (name.startsWith('hind-leg-')) {
      const side = name.endsWith('left') ? 1 : -1;
      part.rotation.x =
        pose === 'hop'
          ? -0.45
          : pose === 'walk'
            ? -side * wave * 0.38
            : pose === 'lie' || pose === 'sleep'
              ? -0.7
              : 0;
    }
  }
}

/** Dispose only resources owned by this generated rabbit. */
export function disposeProceduralRabbit(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
