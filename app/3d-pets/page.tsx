'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { petReplacements, replacementFor } from '@/lib/pet-replacements';
import { animalCandidateIds, candidateDisplayName, type AnimalCandidateId } from '@/lib/species-3d';

const ReplacementPet = dynamic(() => import('@/components/replacement-pet'), { ssr: false });

export default function ReplacementGallery() {
  const [selected, setSelected] = useState<AnimalCandidateId | null>(null);
  const asset = selected ? replacementFor(selected, true) : null;
  return (
    <main className="replacement-gallery">
      <a href="/">← Return to MyPets</a>
      <header>
        <p className="cat-lab-eyebrow">3D pets · replacement preview</p>
        <h1>A closer look at your companions.</h1>
        <p>
          Explore new animal models from every angle. Preview models are still under review; your
          original illustrations remain available.
        </p>
      </header>
      <div className="replacement-grid">
        {animalCandidateIds.map((id) => {
          const entry = petReplacements[id];
          const available = replacementFor(id, true);
          return (
            <article key={id}>
              <img
                src={entry.fallbackIllustration}
                alt={candidateDisplayName(id) + ' illustration'}
                width={240}
                height={200}
              />
              <h2>{candidateDisplayName(id)}</h2>
              <p>
                {available
                  ? entry.approval === 'approved'
                    ? '3D replacement ready'
                    : 'Experimental 3D replacement'
                  : 'Illustration · replacement pending'}
              </p>
              {available && (
                <button type="button" onClick={() => setSelected(id)}>
                  Explore {candidateDisplayName(id).toLowerCase()} in 3D
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p>
        <a href="/3d-lab/">Earlier Blender studies</a> ·{' '}
        <a href="/3d-asset-credits.txt">Asset credits and licenses</a>
      </p>
      {asset && (
        <ReplacementPet
          key={asset.modelId}
          asset={asset}
          name={candidateDisplayName(asset.speciesId)}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}
