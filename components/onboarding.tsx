'use client';
import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CameraIcon,
  UploadSimpleIcon,
  ScanIcon,
  MagnifyingGlassIcon,
  DogIcon,
  CatIcon,
  RabbitIcon,
  XIcon,
  BirdIcon,
  FishIcon,
  PawPrintIcon,
} from '@phosphor-icons/react';
import { Animal, Brand, IconButton } from './shared';
import { breedOptions, type Pet, type Species } from '@/lib/care';
import { speciesList, speciesNames } from '@/lib/species';
import { photoToDataUrl } from '@/lib/storage';
import { identifyBreed, type BreedGuess } from '@/lib/identify';
export default function Onboarding({
  onSave,
  onExplore,
  onClose,
  initial,
}: {
  onSave: (pet: Pet) => void;
  onExplore?: () => void;
  onClose?: () => void;
  initial?: Pet;
}) {
  const [step, setStep] = useState(initial ? 1 : onClose ? 1 : 0);
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'dog');
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [months, setMonths] = useState(initial?.ageMonths ?? 24);
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>(
    initial && initial.ageMonths < 12 ? 'months' : 'years',
  );
  const [photo, setPhoto] = useState(initial?.photo ?? '');
  const [weight, setWeight] = useState(initial?.weightKg?.toString() ?? '');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [status, setStatus] = useState('');
  const [guesses, setGuesses] = useState<BreedGuess[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const upload = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      setPhoto(await photoToDataUrl(file));
      setGuesses([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This photo could not be opened.');
    }
  };
  const identify = async () => {
    if (!photo) {
      fileRef.current?.click();
      return;
    }
    setIdentifying(true);
    setError('');
    try {
      const results = await identifyBreed(photo, species, setStatus);
      setGuesses(results);
      setStatus(
        results.length
          ? 'These are visual suggestions. Choose one to confirm.'
          : 'No confident breed match. You can choose a breed or continue with “I don’t know”.',
      );
    } catch {
      setError(
        'Recognition could not load. Check your connection, or choose “I don’t know” to continue.',
      );
    } finally {
      setIdentifying(false);
    }
  };
  const finish = () => {
    if (!name.trim()) {
      setError('What should we call your pet?');
      return;
    }
    if (!Number.isFinite(months) || months < 1 || months > 480) {
      setError('Enter an age between 1 month and 40 years.');
      return;
    }
    if (
      weight &&
      (!Number.isFinite(Number(weight)) || Number(weight) <= 0 || Number(weight) > 200)
    ) {
      setError('Enter a weight between 0 and 200 kg.');
      return;
    }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim().slice(0, 40),
      species,
      breed: breed || 'Unknown',
      ageMonths: months,
      ...(photo ? { photo } : {}),
      ...(weight ? { weightKg: Number(weight) } : {}),
    });
  };
  const speciesIcons = {
    dog: DogIcon,
    cat: CatIcon,
    rabbit: RabbitIcon,
    chicken: BirdIcon,
    fish: FishIcon,
    hamster: PawPrintIcon,
    bird: BirdIcon,
    'guinea-pig': PawPrintIcon,
  };
  const variety = species === 'fish' || species === 'bird';
  const chooseSpecies = (s: Species) => {
    if (s !== species) {
      setBreed('');
      setGuesses([]);
    }
    setSpecies(s);
  };
  return (
    <main className={`onboarding ${step === 0 ? 'welcome' : ''}`}>
      <header className="onboard-header">
        <Brand />
        {step > 0 ? (
          <div className="onboard-steps">
            {[1, 2, 3].map((s) => (
              <span className={s <= step ? 'active' : ''} key={s} />
            ))}
          </div>
        ) : (
          <span className="quiet-label">A better everyday, together</span>
        )}
        {onClose && (
          <IconButton label="Close onboarding" onClick={onClose}>
            <XIcon size={22} />
          </IconButton>
        )}
      </header>
      <input
        hidden
        type="file"
        accept="image/*"
        ref={fileRef}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraRef}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className={`onboard-content step-${step}`}
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 ? (
            <>
              <div className="welcome-art">
                <span className="welcome-orbit orbit-one" />
                <span className="welcome-orbit orbit-two" />
                <div className="welcome-pet">
                  <Animal species="dog" interactive />
                </div>
                <span className="welcome-caption">A world built around them.</span>
              </div>
              <div className="welcome-copy">
                <span className="eyebrow">YOUR EVERYDAY COMPANION</span>
                <h1>
                  Their little world.
                  <br />
                  <em>A little closer.</em>
                </h1>
                <p>
                  Understand what makes them, them.
                  <br />
                  One small, lovely moment at a time.
                </p>
                <div className="welcome-actions">
                  <button className="primary-button" onClick={() => setStep(1)}>
                    Meet my pet <ArrowRightIcon size={21} />
                  </button>
                  <button className="plain-button" onClick={onExplore}>
                    Explore with Milo <ArrowRightIcon size={17} />
                  </button>
                </div>
                <div className="welcome-footer">
                  <span className="tiny-line" />
                  Made for the ones you love.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="onboard-title">
                <span className="eyebrow">
                  {step === 1
                    ? '01 · YOUR COMPANION'
                    : step === 2
                      ? '02 · A LITTLE BACKGROUND'
                      : '03 · MAKE IT PERSONAL'}
                </span>
                <h1>
                  {step === 1 ? (
                    <>
                      Who makes your
                      <br />
                      <em>world a little brighter?</em>
                    </>
                  ) : step === 2 ? (
                    <>
                      {variety ? 'A world of' : 'A breed of'}
                      <br />
                      <em>their own.</em>
                    </>
                  ) : (
                    <>
                      Let’s get to know
                      <br />
                      <em>your little one.</em>
                    </>
                  )}
                </h1>
                <p>
                  {step === 1
                    ? 'Every pet has a different rhythm. Let’s find theirs.'
                    : step === 2
                      ? 'This helps us tailor their care. Not sure? That’s okay.'
                      : 'A name, an age, and a face you love.'}
                </p>
              </div>
              {step === 1 ? (
                <div className="species-grid">
                  {speciesList.map((s) => {
                    const Icon = speciesIcons[s];
                    return (
                      <motion.button
                        key={s}
                        className={`species-card ${s} ${species === s ? 'selected' : ''}`}
                        aria-label={speciesNames[s]}
                        aria-pressed={species === s}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => chooseSpecies(s)}
                      >
                        <Animal species={s} />
                        <div>
                          <Icon size={21} weight={species === s ? 'fill' : 'regular'} />
                          <span>{speciesNames[s]}</span>
                          <AnimatePresence>
                            {species === s && (
                              <motion.span
                                className="species-check"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                              >
                                <CheckIcon size={18} weight="bold" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : step === 2 ? (
                <div className="breed-stage">
                  <div className="identify-card">
                    <div className="identify-icon">
                      <ScanIcon size={28} />
                    </div>
                    <div>
                      <h3>A photo can help</h3>
                      <p>
                        {['dog', 'cat', 'rabbit', 'fish'].includes(species)
                          ? 'On-device suggestions. You confirm the match.'
                          : 'Add a photo. Choose the variety or “I don’t know”.'}
                      </p>
                    </div>
                    <IconButton
                      label="Take a breed photo"
                      onClick={() => cameraRef.current?.click()}
                    >
                      <CameraIcon size={22} />
                    </IconButton>
                    <IconButton
                      label="Upload a breed photo"
                      onClick={() => fileRef.current?.click()}
                    >
                      <UploadSimpleIcon size={22} />
                    </IconButton>
                  </div>
                  {photo && ['dog', 'cat', 'rabbit', 'fish'].includes(species) && (
                    <div className="identify-preview">
                      <img src={photo} alt="Your companion for breed recognition" />
                      <button
                        className="secondary-button"
                        disabled={identifying}
                        onClick={() => {
                          void identify();
                        }}
                      >
                        <ScanIcon size={18} />
                        {identifying ? 'Looking…' : 'Identify breed'}
                      </button>
                      <span role="status">{status}</span>
                    </div>
                  )}
                  {guesses.length > 0 && (
                    <div className="guess-list">
                      {guesses.map((g) => (
                        <button
                          key={g.breed}
                          aria-pressed={breed === g.breed}
                          className={breed === g.breed ? 'selected' : ''}
                          onClick={() => setBreed(g.breed)}
                        >
                          {g.breed}
                          <span>{Math.round(g.confidence * 100)}% model score</span>
                        </button>
                      ))}
                      <p className="fine-print">
                        Appearance cannot verify ancestry, especially for mixed breeds.
                      </p>
                    </div>
                  )}
                  <label className="search-field">
                    <MagnifyingGlassIcon size={20} />
                    <input
                      placeholder={variety ? 'Search species or varieties' : 'Search breeds'}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <div className="breed-options">
                    <button
                      className={`breed-option ${breed === 'Unknown' ? 'selected' : ''}`}
                      aria-pressed={breed === 'Unknown'}
                      onClick={() => setBreed('Unknown')}
                    >
                      <span>
                        I don’t know
                        <span className="option-note">We’ll start with species and age.</span>
                      </span>
                      <span className="radio-dot">
                        {breed === 'Unknown' && <CheckIcon size={14} />}
                      </span>
                    </button>
                    {breedOptions[species]
                      .filter((b) => b.toLowerCase().includes(query.toLowerCase()))
                      .map((b) => (
                        <button
                          key={b}
                          aria-pressed={breed === b}
                          className={`breed-option ${breed === b ? 'selected' : ''}`}
                          onClick={() => setBreed(b)}
                        >
                          {b}
                          <span className="radio-dot">
                            {breed === b && <CheckIcon size={14} />}
                          </span>
                        </button>
                      ))}
                    {query &&
                      !breedOptions[species].some(
                        (b) => b.toLowerCase() === query.toLowerCase(),
                      ) && (
                        <button
                          className="breed-option"
                          aria-pressed={breed === query.trim()}
                          onClick={() => setBreed(query.trim())}
                        >
                          Use “{query.trim()}”
                          <span className="radio-dot">
                            {breed === query.trim() && <CheckIcon size={14} />}
                          </span>
                        </button>
                      )}
                  </div>
                </div>
              ) : (
                <div className="personal-stage">
                  <div className="photo-upload">
                    <div className="pet-photo-frame">
                      <Animal species={species} breed={breed} photo={photo} />
                    </div>
                    <div>
                      <h3>A face to make you smile.</h3>
                      <p>Optional. You can change it anytime.</p>
                      <div className="flex gap-3">
                        <IconButton
                          label="Upload pet photo"
                          onClick={() => fileRef.current?.click()}
                        >
                          <UploadSimpleIcon size={22} />
                        </IconButton>
                        <IconButton
                          label="Take pet photo"
                          onClick={() => cameraRef.current?.click()}
                        >
                          <CameraIcon size={22} />
                        </IconButton>
                        {photo && (
                          <button className="plain-button" onClick={() => setPhoto('')}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <label className="form-label">
                    Their name
                    <input
                      autoComplete="off"
                      maxLength={40}
                      placeholder="e.g. Milo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div className="age-field">
                    <label className="form-label">
                      Their age
                      <input
                        type="number"
                        min={ageUnit === 'years' ? 1 / 12 : 1}
                        max={ageUnit === 'years' ? 40 : 480}
                        step={ageUnit === 'years' ? 1 / 12 : 1}
                        value={ageUnit === 'years' ? Math.round((months / 12) * 100) / 100 : months}
                        onChange={(e) =>
                          setMonths(
                            Math.round(Number(e.target.value) * (ageUnit === 'years' ? 12 : 1)),
                          )
                        }
                      />
                    </label>
                    <label className="form-label">
                      Measured in
                      <select
                        value={ageUnit}
                        onChange={(e) => setAgeUnit(e.target.value as 'years' | 'months')}
                      >
                        <option value="years">Years</option>
                        <option value="months">Months</option>
                      </select>
                    </label>
                  </div>
                  <label className="form-label">
                    Weight in kg <span className="optional">Optional</span>
                    <input
                      type="number"
                      min="0.1"
                      max="200"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 24"
                    />
                  </label>
                  <p className="fine-print">
                    Your pets and photos stay on this device. No account needed.
                  </p>
                </div>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <footer className="onboard-controls">
                <IconButton
                  label="Previous onboarding step"
                  onClick={() => {
                    setError('');
                    setStep(step - 1);
                  }}
                >
                  <ArrowLeftIcon size={22} />
                </IconButton>
                <span className="step-count">{step} of 3</span>
                <button
                  className="primary-button"
                  disabled={step === 2 && !breed}
                  onClick={() => {
                    setError('');
                    if (step < 3) setStep(step + 1);
                    else finish();
                  }}
                >
                  {step === 3
                    ? initial
                      ? 'Save changes'
                      : 'Meet ' + (name.trim() || 'my pet')
                    : 'Continue'}
                  <ArrowRightIcon size={21} />
                </button>
              </footer>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
