'use client';
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'motion/react';
import { XIcon, ArrowUpRightIcon, PawPrintIcon, SpeakerHighIcon } from '@phosphor-icons/react';
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
  const reduced = useReducedMotion();
  const [happy, setHappy] = useState(false);
  const asset = animalAsset(species, breed);
  const graphic = (
    <motion.div
      className={`animal-art ${species} asset-${asset} ${photo ? 'user-photo' : ''} ${className}`}
      animate={
        reduced
          ? {}
          : {
              y: happy ? [0, -14, 0] : [0, -7, 0],
              rotate: happy ? [0, -6, 6, 0] : [0, -1.5, 1.5, 0],
            }
      }
      transition={{ duration: happy ? 0.65 : 6, repeat: happy ? 0 : Infinity, ease: 'easeInOut' }}
    >
      <img
        src={photo || `/animals/${asset}.jpg`}
        alt={
          photo ? 'Your pet' : `The supplied ${speciesNames[species].toLowerCase()} illustration`
        }
        draggable={false}
      />
    </motion.div>
  );
  if (!interactive) return graphic;
  return (
    <motion.button
      type="button"
      className="animal-interaction"
      aria-label={`Interact with the ${speciesNames[species].toLowerCase()}`}
      drag
      dragConstraints={{ left: -14, right: 14, top: -10, bottom: 10 }}
      dragElastic={0.12}
      whileHover={reduced ? undefined : { scale: 1.025, rotateY: 6 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      onClick={() => {
        setHappy(true);
        haptic(true);
        if (sound) playTone();
        setTimeout(() => setHappy(false), 750);
      }}
    >
      {graphic}
    </motion.button>
  );
}
export function Sheet({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const closeRef = useRef(onClose);
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
        const focusables = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]',
        );
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
          className="sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="sheet-backdrop" onClick={onClose} aria-label={`Close ${title}`} />
          <motion.div
            ref={ref}
            className={`sheet ${wide ? 'sheet-wide' : ''}`}
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
      <span className="brand-symbol">
        <PawPrintIcon weight="fill" size={22} />
      </span>
      my pets<span className="brand-dot">.</span>
    </span>
  );
}
export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button className={`text-toggle ${enabled ? 'on' : ''}`} onClick={onToggle}>
      <SpeakerHighIcon size={18} weight={enabled ? 'fill' : 'regular'} />
      Sound {enabled ? 'on' : 'off'}
    </button>
  );
}
