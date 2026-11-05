'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { petRenderQuality } from '@/lib/pet-scene';

/** An owned studio environment. GPU buffers are never retained after the viewer closes. */
export function PetStudioEnvironment() {
  const { gl, scene, size, setDpr, invalidate } = useThree();
  const quality = useMemo(() => {
    const context = gl.getContext();
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER),
    );
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
    return petRenderQuality(renderer, size.width, size.height, dpr);
  }, [gl, size.width, size.height]);

  useEffect(() => {
    setDpr(quality.dpr);
  }, [setDpr, quality.dpr]);

  useEffect(() => {
    if (quality.software) return;
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(room, 0.05);
    const previous = scene.environment;
    const intensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = 0.72;
    room.dispose();
    generator.dispose();
    invalidate();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = intensity;
      target.dispose();
      invalidate();
    };
  }, [gl, scene, quality.software, invalidate]);

  return null;
}
