'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AnimalAnimationContext } from '@/components/shared';
import { readData } from '@/lib/storage';
import { ArrowLeftIcon, CubeTransparentIcon, PawPrintIcon } from '@phosphor-icons/react';
import {
  animalCandidateIds,
  candidateDisplayName,
  chibiCandidateModelUrl,
  candidateModelUrl,
  type AnimalCandidateId,
} from '@/lib/species-3d';

const ThreeDCatStudio = dynamic(() => import('@/components/tripo-pet'), { ssr: false });

/**
 * An explicit review route for rig fidelity and interaction QA.
 * It does not replace the original pet illustrations or approve the model.
 */
export default function ThreeDLabPage() {
  const [open, setOpen] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setAnimationEnabled(readData()?.animalAnimations !== false);
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const [selected, setSelected] = useState<AnimalCandidateId>('cat');
  const [visualStyle, setVisualStyle] = useState<'video' | 'previous'>('video');
  const cat = selected === 'cat';
  const videoStyleUrl = chibiCandidateModelUrl(selected);
  const selectedUrl =
    visualStyle === 'video' && videoStyleUrl ? videoStyleUrl : candidateModelUrl(selected);

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
        <p className="cat-lab-eyebrow">Experimental 3D character laboratory</p>
        <h1 id="cat-lab-title">
          {cat ? 'A living calico, not a moving picture.' : 'A 3D study of every pet.'}
        </h1>
        <p>
          Review experimental Blender 3D models against the original animal illustrations. Try each
          species’ anatomy, movement, eating, expression and touch controls. Every candidate
          requires individual visual approval before replacing any artwork.
        </p>
        <label htmlFor="animal-study-select">Choose an animal to review</label>
        <select
          id="animal-study-select"
          value={selected}
          onChange={(event) => setSelected(event.target.value as AnimalCandidateId)}
        >
          {animalCandidateIds.map((id) => (
            <option key={id} value={id}>
              {candidateDisplayName(id)}
            </option>
          ))}
        </select>
        <figure aria-label="Original supplied animal illustration for 3D comparison">
          <Image
            src={'/animals/' + selected + '.webp'}
            alt={'Original ' + candidateDisplayName(selected).toLowerCase() + ' artwork'}
            width={200}
            height={200}
            style={{ display: 'block', width: 'min(200px, 100%)', height: 'auto', marginInline: 'auto', objectFit: 'contain' }}
          />
          <figcaption className="cat-lab-disclaimer">
            Original 2D reference — compare the 3D model against this artwork.
          </figcaption>
        </figure>
        <p className="cat-lab-disclaimer">
          Animations: {animationEnabled ? 'On' : 'Off'} — controlled from the main app Settings.
          You can still rotate and inspect static 3D models.
        </p>
        {videoStyleUrl && (
          <div className="cat-lab-style-picker" role="group" aria-label="Choose 3D character style">
            <button
              type="button"
              aria-pressed={visualStyle === 'video'}
              onClick={() => setVisualStyle('video')}
            >
              Joyful video-reference prototype
            </button>
            <button
              type="button"
              aria-pressed={visualStyle === 'previous'}
              onClick={() => setVisualStyle('previous')}
            >
              Previous anatomical study
            </button>
          </div>
        )}
        <button className="cat-lab-launch" onClick={() => setOpen(true)}>
          <PawPrintIcon size={22} aria-hidden="true" />
          {cat ? 'Open the Blender cat studio' : 'Open the Blender animal studio'}
        </button>
        <p className="cat-lab-disclaimer">
          Video-inspired chibi characters and previous anatomical studies are separately rigged
          experimental GLBs. Neither is a photoreal reconstruction or motion capture. Original
          illustrated pets stay unchanged.
        </p>
      </section>
      {open && (
        <ThreeDCatStudio
          key={selected + ':' + visualStyle}
          name={cat ? 'Calico cat' : candidateDisplayName(selected)}
          defaultCandidate
          candidateUrl={selectedUrl}
          referenceImageUrl={'/animals/' + selected + '.webp'}
          allowProceduralCat={cat}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
    </AnimalAnimationContext.Provider>
  );
}
