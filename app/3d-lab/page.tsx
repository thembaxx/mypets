'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AnimalAnimationContext } from '@/components/shared';
import { readData, STORAGE_KEY } from '@/lib/storage';
import { ArrowLeftIcon, CubeTransparentIcon, PawPrintIcon } from '@phosphor-icons/react';

const ThreeDCatStudio = dynamic(() => import('@/components/tripo-pet'), { ssr: false });

/**
 * An explicit review route for the code-native procedural cat and interaction QA.
 * It does not replace the original pet illustrations.
 */
export default function ThreeDLabPage() {
  const [open, setOpen] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(false);
  useEffect(() => {
    const sync = () => setAnimationEnabled(readData()?.animalAnimations !== false);
    sync();
    const changed = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) sync();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  return (
    <AnimalAnimationContext.Provider value={animationEnabled}>
      <main className="cat-lab-page">
        <section className="cat-lab-content" aria-labelledby="cat-lab-title">
          <a className="cat-lab-back" href="/">
            <ArrowLeftIcon size={18} aria-hidden="true" /> Return to MyPets
          </a>
          <div className="cat-lab-emblem" aria-hidden="true">
            <CubeTransparentIcon size={30} />
          </div>
          <a href="/3d-pets/">Explore the new replacement models →</a>
          <p className="cat-lab-eyebrow">Experimental 3D character laboratory</p>
          <h1 id="cat-lab-title">A living calico, built in code.</h1>
          <p>
            Explore a code-native Three.js cat prototype with procedural materials, expressive
            movement and interactive behaviours. The original illustrated pets remain
            unchanged. No Blender or external model-authoring pipeline is used for this
            prototype.
          </p>
          <button className="cat-lab-launch" onClick={() => setOpen(true)}>
            <PawPrintIcon size={22} aria-hidden="true" />
            Open the code-native cat studio
          </button>
          <p className="cat-lab-disclaimer">
            The prototype is authored directly with Three.js and custom WebGL shader code.
            Imported models are not used in this review. Original illustrated pets stay
            unchanged.
          </p>
        </section>
        {open && (
          <ThreeDCatStudio
            name="Calico cat"
            allowProceduralCat={false}
            onClose={() => setOpen(false)}
          />
        )}
      </main>
    </AnimalAnimationContext.Provider>
  );
}
