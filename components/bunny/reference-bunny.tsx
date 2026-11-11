'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber';
import { useReducedMotion } from 'motion/react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimalAnimationContext } from '@/components/shared';
import {
  BunnyAnimationController,
  type BunnyAction,
  type BunnyEmotion,
  type BunnyTouchRegion,
} from '@/lib/bunny/animation-controller';

type Props = {
  url: string;
  action?: BunnyAction;
  emotion?: BunnyEmotion;
  paused?: boolean;
  onTouch?: (region: BunnyTouchRegion) => void;
};

/**
 * Only mount inside an existing R3F Canvas after its candidate has passed
 * structural, visual and browser reviews. This component does NOT promote an
 * experimental GLB or replace the original pet illustration.
 */
export default function ReferenceBunny({
  url,
  action = 'Idle',
  emotion = 'neutral',
  paused = false,
  onTouch,
}: Props) {
  const gltf = useLoader(GLTFLoader, url);
  const root = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const controller = useMemo(
    () => new BunnyAnimationController(root, gltf.animations),
    [root, gltf.animations],
  );
  const animationsEnabled = useContext(AnimalAnimationContext);
  const prefersReducedMotion = !!useReducedMotion();
  const [visible, setVisible] = useState(true);
  const enabled = animationsEnabled && !prefersReducedMotion && !paused && visible;

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    controller.setEnabled(enabled);
  }, [controller, enabled]);
  useEffect(() => {
    controller.play(action);
  }, [controller, action]);
  useEffect(() => {
    controller.express(emotion);
  }, [controller, emotion]);
  useEffect(() => () => controller.dispose(), [controller]);

  useFrame((_, delta) => {
    if (enabled) controller.update(delta);
  });

  const interact = (event: ThreeEvent<MouseEvent>) => {
    // Ignore pointer drags (orbit controls) so dragging is not petting.
    if (event.delta > 6 || !enabled) return;
    event.stopPropagation();
    const name = event.object.name.toLowerCase();
    const region: BunnyTouchRegion = name.includes('ear')
      ? 'ear'
      : name.includes('paw') || name.includes('foot')
        ? 'paw'
        : name.includes('head') || name.includes('eye')
          ? 'head'
          : 'body';
    if (onTouch) onTouch(region);
    else controller.reactToTouch(region);
  };

  return <primitive object={root} dispose={null} onClick={interact} />;
}
