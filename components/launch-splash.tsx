'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { brand } from '@/lib/brand';

export function SplashScreen({
  exiting = false,
  imageRef,
  onArtworkReady,
  playVideo = false,
  onPlaybackError,
  onSkip,
  ready = false,
}: {
  exiting?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
  onArtworkReady?: () => void;
  playVideo?: boolean;
  onPlaybackError?: () => void;
  onSkip?: () => void;
  ready?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPlaying(false);
    const video = videoRef.current;
    if (!playVideo || !video) return;
    let cancelled = false;
    // Muted inline playback also works on iOS. A rejected autoplay falls back to the poster.
    video.muted = true;
    void video.play()?.catch(() => {
      if (!cancelled) onPlaybackError?.();
    });
    return () => {
      cancelled = true;
      video.pause();
    };
  }, [playVideo, onPlaybackError]);
  return (
    <div
      className={`launch-splash${exiting ? ' is-leaving' : ''}`}
      role="status"
      aria-label={`Loading ${brand.name}`}
      aria-busy="true"
    >
      <div className="launch-content">
        <div
          className={`launch-art${playing && playVideo ? ' video-playing' : ''}`}
          aria-hidden="true"
        >
          <img
            ref={imageRef}
            src="/brand/launch.webp"
            alt=""
            width={544}
            height={544}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            onLoad={onArtworkReady}
            onError={onArtworkReady}
          />
          {playVideo && (
            <video
              ref={videoRef}
              src="/brand/launch.mp4"
              poster="/brand/launch.webp"
              width={544}
              height={544}
              autoPlay
              muted
              playsInline
              loop
              preload="auto"
              tabIndex={-1}
              disablePictureInPicture
              onPlaying={() => {
                setPlaying(true);
                onArtworkReady?.();
              }}
              onError={onPlaybackError}
            />
          )}
        </div>
        <div className="launch-identity">
          <h1 aria-label={brand.name}>
            {brand.wordmark}
            <span>.</span>
          </h1>
          <p>{brand.tagline}</p>
        </div>
      </div>
      {onSkip && (
        <button
          type="button"
          className="icon-button launch-skip"
          aria-label={`Open ${brand.name}`}
          title={`Open ${brand.name}`}
          disabled={!ready || exiting}
          onClick={onSkip}
        >
          <ArrowRightIcon size={23} />
        </button>
      )}
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
  const [playVideo, setPlayVideo] = useState(false);
  const playbackFailed = useCallback(() => {
    setPlayVideo(false);
    setIntroComplete(true);
  }, []);

  useEffect(() => {
    // Cached images may finish before React attaches the load handler.
    if (imageRef.current?.complete) setArtworkReady(true);
    // Keep the first server paint still until the motion preference is known.
    setPlayVideo(reduced === false);
    const intro = window.setTimeout(() => setIntroComplete(true), reduced ? 120 : 2600);
    // A slow or failed video must never hold the app behind the launch screen.
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
      playVideo={playVideo}
      onPlaybackError={playbackFailed}
      ready={ready}
      onSkip={() => {
        if (ready) setExiting(true);
      }}
    />
  );
}
