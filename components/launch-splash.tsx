'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { brand } from '@/lib/brand';

export function SplashScreen({
  exiting = false,
  imageRef,
  onArtworkReady,
}: {
  exiting?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
  onArtworkReady?: () => void;
}) {
  return (
    <div
      className={`launch-splash${exiting ? ' is-leaving' : ''}`}
      role="status"
      aria-label={`Loading ${brand.name}`}
      aria-busy="true"
    >
      <div className="launch-content">
        <div className="launch-art" aria-hidden="true">
          <img
            ref={imageRef}
            src="/brand/launch.webp"
            alt=""
            width={1254}
            height={1254}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            onLoad={onArtworkReady}
            onError={onArtworkReady}
          />
        </div>
        <div className="launch-identity">
          <h1 aria-label={brand.name}>
            {brand.wordmark}
            <span>.</span>
          </h1>
          <p>{brand.tagline}</p>
        </div>
      </div>
    </div>
  );
}

export default function LaunchSplash({
  ready,
  onComplete,
}: {
  ready: boolean;
  onComplete: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const reduced = useReducedMotion();
  const [artworkReady, setArtworkReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Cached images may finish before React attaches the load handler.
    if (imageRef.current?.complete) setArtworkReady(true);
    const intro = window.setTimeout(() => setIntroComplete(true), reduced ? 120 : 700);
    // A slow or failed image must never hold the app behind the launch screen.
    const fallback = window.setTimeout(() => setArtworkReady(true), 1800);
    return () => {
      window.clearTimeout(intro);
      window.clearTimeout(fallback);
    };
  }, [reduced]);

  useEffect(() => {
    if (ready && artworkReady && introComplete) setExiting(true);
  }, [ready, artworkReady, introComplete]);

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(onComplete, reduced ? 0 : 220);
    return () => window.clearTimeout(timer);
  }, [exiting, reduced, onComplete]);

  return (
    <SplashScreen
      exiting={exiting}
      imageRef={imageRef}
      onArtworkReady={() => setArtworkReady(true)}
    />
  );
}
