'use client';
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { approvedTripoModels, type AnimalAsset } from '@/lib/tripo-models';
const TripoPet = dynamic(() => import('./tripo-pet'), { ssr: false });
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'motion/react';
import {
  XIcon,
  ArrowUpRightIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  HeartIcon,
} from '@phosphor-icons/react';
import { brand } from '@/lib/brand';
import type { Species } from '@/lib/care';
import { animalAsset, speciesNames } from '@/lib/species';
export function haptic(success = false) {
  if (typeof navigator !== 'undefined' && navigator.vibrate)
    navigator.vibrate(success ? [12, 35, 12] : 8);
}
export function playTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(940, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* Sound is an optional enhancement. */
  }
}
export function IconButton({
  label,
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      whileTap={reduced ? undefined : { scale: 0.92 }}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 480, damping: 27 }}
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={() => {
        haptic();
        onClick?.();
      }}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
// Shared across the whole app so one setting pauses every animal illustration.
export const AnimalAnimationContext = createContext(true);

export function Animal({
  species,
  breed,
  className = '',
  interactive = false,
  photo,
  sound = false,
}: {
  species: Species;
  breed?: string;
  className?: string;
  interactive?: boolean;
  photo?: string;
  sound?: boolean;
}) {
  const enabled = useContext(AnimalAnimationContext);
  const reduced = useReducedMotion();
  const [reaction, setReaction] = useState(0);
  const [delighted, setDelighted] = useState(false);
  const [view3d, setView3d] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asset = animalAsset(species, breed);
  const modelUrl = approvedTripoModels[asset as AnimalAsset];
  const animated = enabled && !reduced && !photo;
  const swimmer = ['fish', 'snake', 'salamander'].includes(species);
  const flier = ['bird', 'chicken'].includes(species);
  const playful = ['dog', 'cat', 'ferret', 'rabbit', 'hamster', 'guinea-pig'].includes(species);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const graphic = (
    <motion.div
      className={
        'animal-art ' + species + ' asset-' + asset + (photo ? ' user-photo' : '') + ' ' + className
      }
      animate={
        !animated
          ? { x: 0, y: 0, rotate: 0, scale: 1 }
          : delighted
            ? {
                x: swimmer ? [0, 5, -4, 0] : [0, -2, 2, 0],
                y: flier ? [0, -12, -4, 0] : [0, -9, 1, 0],
                rotate: [0, reaction % 2 ? -5 : 5, reaction % 2 ? 4 : -4, 0],
                scale: [1, 1.025, 0.99, 1],
              }
            : {
                x: swimmer ? [0, 3, 0, -3, 0] : [0, 0, 0, 0, 0],
                y: [0, flier ? -5 : playful ? -3 : -2, 0, 1, 0],
                rotate: [0, swimmer ? 2 : -1, 0, swimmer ? -2 : 1, 0],
                scale: 1,
              }
      }
      transition={
        !animated
          ? { duration: 0 }
          : {
              duration: delighted ? 0.78 : swimmer ? 5.2 : flier ? 4.5 : 6.4,
              ease: 'easeInOut',
              repeat: delighted ? 0 : Infinity,
            }
      }
    >
      <img
        src={photo || '/animals/' + asset + '.webp'}
        alt={
          photo
            ? 'Your pet'
            : 'The supplied ' + speciesNames[species].toLowerCase() + ' illustration'
        }
        draggable={false}
      />
    </motion.div>
  );

  // Keep the same footprint even when the illustration is entirely still.
  if (!interactive) return graphic;
  if (!animated) return <div className="animal-interaction is-static">{graphic}</div>;

  return (
    <>
    <motion.button
      type="button"
      className="animal-interaction"
      aria-label={'Play with the ' + speciesNames[species].toLowerCase() + ' illustration'}
      drag
      dragConstraints={{ left: -12, right: 12, top: -9, bottom: 9 }}
      dragElastic={0.1}
      dragSnapToOrigin
      whileHover={{ scale: 1.018, rotate: swimmer ? 1.5 : -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        setReaction((value) => value + 1);
        setDelighted(true);
        haptic(true);
        if (sound) playTone();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setDelighted(false), 830);
      }}
    >
      {graphic}
      <AnimatePresence>
        {delighted && (
          <motion.span
            key={reaction}
            className="animal-delight"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.45, y: 9, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, y: -10, rotate: 10 }}
            exit={{ opacity: 0, scale: 0.8, y: -24 }}
            transition={{ duration: 0.48 }}
          >
            <HeartIcon size={22} weight="fill" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
    {modelUrl && (
      <button type="button" className="animal-3d-launch" onClick={() => setView3d(true)}>
        Explore in 3D
      </button>
    )}
    {view3d && modelUrl && (
      <TripoPet url={modelUrl} name={speciesNames[species]} onClose={() => setView3d(false)} />
    )}
    </>
  );
}
export function Sheet({
  open,
  title,
  children,
  onClose,
  wide = false,
  variant = 'default',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  variant?: 'default' | 'assistant' | 'event';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const closeRef = useRef(onClose);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || variant !== 'assistant' || !window.visualViewport) return;
    const visual = window.visualViewport;
    const updateViewport = () => {
      if (visual.scale === 1) setViewport({ height: visual.height, top: visual.offsetTop });
    };
    updateViewport();
    visual.addEventListener('resize', updateViewport);
    visual.addEventListener('scroll', updateViewport);
    return () => {
      visual.removeEventListener('resize', updateViewport);
      visual.removeEventListener('scroll', updateViewport);
    };
  }, [open, variant]);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(
      () => ref.current?.querySelector<HTMLElement>('button,input,[tabindex="0"]')?.focus(),
      100,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const focusables = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length && !element.closest('[inert]'));
        if (!focusables?.length) return;
        const first = focusables[0],
          last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = old;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`sheet-layer ${variant === 'assistant' ? 'assistant-sheet-layer' : ''}`}
          style={
            variant === 'assistant' && viewport
              ? { height: viewport.height, top: viewport.top, bottom: 'auto' }
              : undefined
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="sheet-backdrop" onClick={onClose} aria-label={`Close ${title}`} />
          <motion.div
            ref={ref}
            className={`sheet ${wide ? 'sheet-wide' : ''} ${variant !== 'default' ? `sheet-${variant}` : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={{ y: '100%', scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.97 }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.65 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 60 || info.velocity.y > 350) onClose();
            }}
          >
            <div
              className="sheet-grabber-area"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span className="sheet-grabber" />
            </div>
            <div className="sheet-heading">
              <h2 id="sheet-title">{title}</h2>
              <IconButton label={`Close ${title}`} onClick={onClose}>
                <XIcon size={22} />
              </IconButton>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function SourceLink({
  href,
  children = 'Read the source',
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a className="source-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRightIcon size={17} />
    </a>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <motion.span
        className="brand-symbol"
        whileHover={{ rotate: -8, scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <BrandMark />
      </motion.span>
      {brand.wordmark}
      <span className="brand-dot">.</span>
    </span>
  );
}
export function BrandMark({
  direction = 'nuzzle',
}: {
  direction?: 'nuzzle' | 'pippa' | 'kindred';
}) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`brand-mark mark-${direction}`}>
      <rect
        width="100"
        height="100"
        rx="27"
        fill={direction === 'nuzzle' ? '#274b3e' : direction === 'pippa' ? '#f6c39d' : '#736483'}
      />
      {direction === 'nuzzle' ? (
        <>
          <path
            d="M20 59C20 44 32 25 43 25C54 25 58 38 54 45C51 50 45 42 44 47C42 53 52 58 45 68C35 81 18 75 20 59Z"
            fill="#fbf2df"
          />
          <path
            d="M58 45C63 38 64 46 73 48C85 51 84 72 73 75C64 78 61 69 59 64C56 58 50 53 58 45Z"
            fill="#fbf2df"
          />
          <circle cx="53" cy="71" r="5" fill="#efa779" />
        </>
      ) : direction === 'pippa' ? (
        <path
          d="M23 62C22 43 46 24 60 25C75 27 83 43 80 53C76 64 62 46 61 46C60 56 66 73 51 77C38 81 24 75 23 62Z"
          fill="#793638"
        />
      ) : (
        <>
          <ellipse
            cx="39"
            cy="55"
            rx="23"
            ry="19"
            fill="none"
            stroke="#fbf2df"
            strokeWidth="12"
            transform="rotate(-35 39 55)"
          />
          <ellipse
            cx="62"
            cy="43"
            rx="23"
            ry="19"
            fill="none"
            stroke="#fbf2df"
            strokeWidth="12"
            transform="rotate(55 62 43)"
          />
        </>
      )}
    </svg>
  );
}
export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <motion.button
      className={`icon-button ${enabled ? 'on' : ''}`}
      onClick={onToggle}
      aria-label={`Sound ${enabled ? 'on' : 'off'}`}
      aria-pressed={enabled}
      title={`Turn sound ${enabled ? 'off' : 'on'}`}
      whileTap={{ scale: 0.9 }}
    >
      {enabled ? <SpeakerHighIcon size={22} weight="fill" /> : <SpeakerSlashIcon size={22} />}
    </motion.button>
  );
}
