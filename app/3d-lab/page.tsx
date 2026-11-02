'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ArrowLeftIcon, CubeTransparentIcon, PawPrintIcon } from '@phosphor-icons/react';

const ThreeDCatStudio = dynamic(() => import('@/components/tripo-pet'), { ssr: false });

/**
 * An explicit review route for rig fidelity and interaction QA.
 * It does not replace the original pet illustrations or approve the model.
 */
export default function ThreeDLabPage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="cat-lab-page">
      <section className="cat-lab-content" aria-labelledby="cat-lab-title">
        <a className="cat-lab-back" href="/">
          <ArrowLeftIcon size={18} aria-hidden="true" /> Return to MyPets
        </a>
        <div className="cat-lab-emblem" aria-hidden="true">
          <CubeTransparentIcon size={30} />
        </div>
        <p className="cat-lab-eyebrow">Experimental 3D character laboratory</p>
        <h1 id="cat-lab-title">A living calico, not a moving picture.</h1>
        <p>
          Review a real skinned Blender model against the original MyPets cat illustration. Test
          walking, eating, facial expressions, play and zoom. This candidate is still being refined
          and is not approved for the main pet collection.
        </p>
        <button className="cat-lab-launch" onClick={() => setOpen(true)}>
          <PawPrintIcon size={22} aria-hidden="true" />
          Open interactive 3D cat studio
        </button>
        <p className="cat-lab-disclaimer">
          The procedural cat and rigged Blender candidate are original 3D geometry. Their movements
          are simulated, not photoreal animal motion capture. No personal pet photos are uploaded.
        </p>
      </section>
      {open && <ThreeDCatStudio name="Calico cat" onClose={() => setOpen(false)} />}
    </main>
  );
}
