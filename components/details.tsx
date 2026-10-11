'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  PlantIcon,
  BellIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  PawPrintIcon,
  HeartIcon,
  XIcon,
} from '@phosphor-icons/react';
import { speciesNames } from '@/lib/species';
import { Animal, IconButton, SourceLink, haptic, playTone } from './shared';
import {
  ageLabel,
  careGuide,
  dateKey,
  factsFor,
  lessonsFor,
  lifeStage,
  sources,
  type Pet,
  type CareEvent,
  type EventKind,
  type Fact,
  type Lesson,
} from '@/lib/care';
export function FactDetail({
  pet,
  fact,
  onFact,
}: {
  pet: Pet;
  fact: Fact;
  onFact: (fact: Fact) => void;
}) {
  const [video, setVideo] = useState(false);
  return (
    <div className="fact-detail">
      <div className={`fact-detail-art ${pet.species}`}>
        <Animal species={pet.species} breed={pet.breed} />
        <span className="art-label">GET TO KNOW {pet.name.toUpperCase()}</span>
      </div>
      <span className="eyebrow">{fact.category.toUpperCase()} · A 1-MINUTE DISCOVERY</span>
      <h3>{fact.title}</h3>
      <p className="lead-paragraph">{fact.teaser}</p>
      <p>{fact.body}</p>
      <SourceLink href={fact.source}>
        {fact.sourceName}
        <ArrowUpRightIcon size={17} />
      </SourceLink>
      <div className="detail-callout">
        <HeartIcon size={22} />
        <p>
          Made for {pet.name}, a {ageLabel(pet.ageMonths)}{' '}
          {pet.breed === 'Unknown' ? speciesNames[pet.species].toLowerCase() : pet.breed}. Every
          companion is an individual.
        </p>
      </div>
      {pet.species === 'dog' && (
        <div className="video-section">
          <h4>A little more to discover</h4>
          {video ? (
            <iframe
              src="https://www.youtube-nocookie.com/embed/g-lxSYmiRMg?autoplay=1"
              title="PDSA: How to exercise your dog"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button className="video-placeholder" onClick={() => setVideo(true)}>
              <span>
                <PlayIcon size={23} weight="fill" />
              </span>
              <div>
                <strong>Exercise, at their own pace</strong>
                <small>Watch PDSA’s practical guide</small>
              </div>
              <ArrowUpRightIcon size={20} />
            </button>
          )}
          <SourceLink href="https://www.pdsa.org.uk/get-involved/our-campaigns/weigh-up/your-dog/your-dogs-body-shape/how-to-exercise-your-dog">
            Video source · PDSA
          </SourceLink>
        </div>
      )}
      <div className="more-facts">
        <h4>More little discoveries</h4>
        {factsFor(pet)
          .filter((f) => f.id !== fact.id)
          .map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setVideo(false);
                onFact(f);
              }}
            >
              <div>
                <span className="eyebrow">{f.category.toUpperCase()}</span>
                <strong>{f.title}</strong>
              </div>
              <ArrowRightIcon size={19} />
            </button>
          ))}
      </div>
    </div>
  );
}
export function DietDetail({ pet }: { pet: Pet }) {
  const guide = careGuide(pet);
  return (
    <div className="diet-detail">
      <div className="diet-illustration">
        <div className="bowl-illustration">
          <span />
          <span />
          <span />
          <span />
          <span />
          <i />
        </div>
        <PlantIcon size={48} weight="duotone" />
      </div>
      <span className="eyebrow">
        {lifeStage(pet).toUpperCase()} {pet.species.replace('-', ' ').toUpperCase()} ·{' '}
        {ageLabel(pet.ageMonths).toUpperCase()}
      </span>
      <h3>{guide.diet}</h3>
      <p className="lead-paragraph">A thoughtful starting point for {pet.name}’s bowl.</p>
      <p>{guide.dietBody}</p>
      <div className="diet-stats">
        <div>
          <strong>{guide.meals}</strong>
          <span>
            {['snake', 'salamander', 'iguana', 'gecko'].includes(pet.species)
              ? 'daily care checks, not feeding frequency'
              : ['rabbit', 'chicken', 'bird', 'guinea-pig', 'ferret'].includes(pet.species)
                ? 'daily freshness checks'
                : pet.species === 'fish'
                  ? 'editable feeding slots'
                  : 'suggested meals a day'}
          </span>
        </div>
        <div>
          <strong>Fresh</strong>
          <span>
            {pet.species === 'fish' ? 'water quality, checked daily' : 'water, always available'}
          </span>
        </div>
      </div>
      <h4>A portion that fits them</h4>
      <p>{guide.portion}</p>
      {pet.weightKg && (
        <p className="detail-callout">
          You recorded {pet.weightKg} kg for {pet.name}. Use their ideal weight, food’s energy
          content, and body condition when checking the label.
        </p>
      )}
      <h4>{pet.species === 'rabbit' ? 'Keep it gentle' : 'The little extras'}</h4>
      <p>
        {['snake', 'hedgehog', 'ferret', 'salamander', 'iguana', 'gecko'].includes(pet.species)
          ? 'Follow the plan for their exact species and age. Log appetite, feeding dates, and body condition. Introduce changes with an exotic-pet vet, and set feeding reminders only when meals are due.'
          : pet.species === 'fish'
            ? 'Keep feeding and water-quality checks together. Remove uneaten food, and confirm the plan with an aquatic specialist before changing the routine.'
            : pet.species === 'chicken'
              ? 'Growing chicks need an age-specific plan. Confirm feeding and brooder care with a poultry vet; do not use laying-hen feed for chicks.'
              : pet.species === 'bird'
                ? 'Make changes gradually with an avian vet. Unweaned birds need specialist feeding care; this routine is for birds eating independently.'
                : pet.species === 'guinea-pig'
                  ? 'Monitor appetite and droppings daily. Seek prompt veterinary advice if eating changes. Keep fresh hay available at all times.'
                  : pet.species === 'rabbit'
                    ? 'Avoid muesli-style mixes and sudden diet changes. Introduce suitable fresh greens gradually. Seek prompt veterinary advice if eating or droppings change.'
                    : 'Use part of the daily food allowance for training rewards. Introduce a new food gradually and check with your vet if your pet has a health condition or a prescribed diet.'}
      </p>
      <SourceLink href={guide.source}>
        Nutrition guidance ·{' '}
        {guide.source.includes('rspca')
          ? 'RSPCA'
          : guide.source.includes('msdvetmanual')
            ? 'MSD Veterinary Manual'
            : 'PDSA veterinary team'}
      </SourceLink>
    </div>
  );
}
export function EventEditor({
  event,
  pet,
  onSave,
  onDelete,
  onClose,
}: {
  event?: CareEvent;
  pet: Pet;
  onSave: (event: CareEvent) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [time, setTime] = useState(event?.time ?? '09:00');
  const [duration, setDuration] = useState(event?.duration ?? 15);
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'reminder');
  const [date, setDate] = useState(event?.date ?? dateKey(new Date()));
  const [repeat, setRepeat] = useState<'daily' | 'once'>(event?.repeat ?? 'once');
  const [note, setNote] = useState(event?.note ?? '');
  const [notify, setNotify] = useState(event?.notify ?? false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!title.trim()) {
      setError('Give this moment a name.');
      return;
    }
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 1440
    ) {
      setError('Choose a valid time and a duration from 1 to 1440 minutes.');
      return;
    }
    if (repeat === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Choose a date.');
      return;
    }
    if (notify && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Denied browser permission still leaves the exported device-calendar alarm available.
      await Notification.requestPermission().catch(() => 'denied');
    }
    onSave({
      id: event?.id ?? crypto.randomUUID(),
      petId: pet.id,
      title: title.trim(),
      time,
      duration,
      kind,
      note,
      date: repeat === 'once' ? date : undefined,
      repeat,
      notify,
    });
    onClose();
  };
  return (
    <form
      className="event-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="detail-callout">
        <PawPrintIcon size={24} />
        <p>
          A little moment for <strong>{pet.name}</strong>.
        </p>
      </div>
      <label className="form-label">
        What’s the plan?
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="e.g. Vet check-up"
          required
        />
      </label>
      <label className="form-label">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
          <option value="reminder">Reminder</option>
          <option value="meal">Meal</option>
          <option value="walk">Walk</option>
          <option value="play">Play & enrichment</option>
          <option value="sleep">Rest</option>
        </select>
      </label>
      <div className="form-two-columns">
        <label className="form-label">
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label className="form-label">
          Minutes
          <input
            type="number"
            min="1"
            max="1440"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <label className="form-label">
        Repeat
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as 'daily' | 'once')}>
          <option value="once">Just this once</option>
          <option value="daily">Every day</option>
        </select>
      </label>
      {repeat === 'once' && (
        <label className="form-label">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      )}
      <label className="form-label">
        A note <span className="optional">Optional</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1200}
          placeholder="Anything to remember?"
        />
      </label>
      <label className="check-label">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <BellIcon size={20} />
        <span>Add a reminder alert</span>
      </label>
      <p className="fine-print">
        Export to your device calendar for alerts when the app is closed. Browser alerts also work
        while open if permission is granted.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="icon-button primary-icon form-save"
        type="submit"
        aria-label={event ? 'Save this moment' : 'Add this moment'}
        title={event ? 'Save this moment' : 'Add this moment'}
      >
        <CheckIcon size={24} />
      </button>
      {event && onDelete && (
        <button
          className="icon-button delete-button"
          aria-label="Remove this event"
          title="Remove this event"
          type="button"
          onClick={() => {
            onDelete(event.id);
            onClose();
          }}
        >
          <TrashIcon size={18} />
        </button>
      )}
    </form>
  );
}
export function LessonDetail({
  pet,
  lesson,
  completed,
  onComplete,
  sound,
}: {
  pet: Pet;
  lesson: Lesson;
  completed: boolean;
  onComplete: () => void;
  sound: boolean;
}) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(lesson.duration * 60);
  const end = useRef(0);
  const finishedSound = useRef(false);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        haptic(true);
        if (sound && !finishedSound.current) {
          playTone();
          finishedSound.current = true;
        }
      }
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running, sound]);
  const advance = () => {
    haptic();
    if (step < lesson.steps.length - 1) setStep(step + 1);
    else onComplete();
  };
  return (
    <div className="lesson-detail">
      <div className={`lesson-detail-art ${lesson.color}`}>
        <Animal species={pet.species} breed={pet.breed} />
        <span className="art-label">A LITTLE TIME TOGETHER</span>
      </div>
      <span className="eyebrow">
        {lesson.category.toUpperCase()} · {lesson.duration}-MINUTE PRACTICE
      </span>
      <h3>{lesson.title}</h3>
      <p className="lead-paragraph">{lesson.subtitle}</p>
      <div className="practice-timer">
        <div>
          <ClockIcon size={20} />
          <strong>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </strong>
          <span>
            {running
              ? 'Take it at their pace.'
              : remaining === 0
                ? 'A lovely little session.'
                : 'A gentle guide, no rush.'}
          </span>
        </div>
        <IconButton
          label={
            running
              ? 'Pause practice timer'
              : remaining === 0
                ? 'Restart practice timer'
                : 'Start practice timer'
          }
          onClick={() => {
            if (remaining === 0) {
              setRemaining(lesson.duration * 60);
              finishedSound.current = false;
            }
            if (!running)
              end.current =
                Date.now() + (remaining === 0 ? lesson.duration * 60 : remaining) * 1000;
            setRunning(!running);
          }}
        >
          {running ? <PauseIcon size={21} weight="fill" /> : <PlayIcon size={21} weight="fill" />}
        </IconButton>
      </div>
      <div className="practice-step-dots">
        {lesson.steps.map((_, i) => (
          <button
            key={i}
            className={i === step ? 'active' : i < step ? 'done' : ''}
            onClick={() => setStep(i)}
            aria-label={`Read step ${i + 1}`}
          >
            {i < step ? <CheckIcon size={13} /> : i + 1}
          </button>
        ))}
      </div>
      <div className="practice-step">
        <span className="eyebrow">
          STEP {step + 1} OF {lesson.steps.length}
        </span>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {lesson.steps[step]}
          </motion.p>
        </AnimatePresence>
      </div>
      <button
        className="icon-button primary-icon practice-next"
        aria-label={
          step === lesson.steps.length - 1
            ? completed
              ? 'Practised again'
              : 'Mark as practised'
            : 'Next little step'
        }
        title={step === lesson.steps.length - 1 ? 'Mark as practised' : 'Next little step'}
        onClick={advance}
      >
        {step === lesson.steps.length - 1 ? <CheckIcon size={20} /> : <ArrowRightIcon size={20} />}
      </button>
      <p className="fine-print">
        Stop if {pet.name} seems uncomfortable or tired. The timer is optional; a good moment
        matters more than minutes.
      </p>
      <SourceLink href={lesson.source}>
        {lesson.source.includes('rspca.org')
          ? 'Based on RSPCA care and welfare guidance'
          : 'Based on PDSA care and reward-based guidance'}
      </SourceLink>
    </div>
  );
}
export function SearchDetail({
  pet,
  events,
  onFact,
  onLesson,
  onEvent,
}: {
  pet: Pet;
  events: CareEvent[];
  onFact: (fact: Fact) => void;
  onLesson: (lesson: Lesson) => void;
  onEvent: (event: CareEvent) => void;
}) {
  const [query, setQuery] = useState('');
  const norm = query.toLowerCase().trim();
  const facts = factsFor(pet).filter((f) =>
    (f.title + ' ' + f.body + ' ' + f.category).toLowerCase().includes(norm),
  );
  const lessons = lessonsFor(pet).filter((l) =>
    (l.title + ' ' + l.subtitle + ' ' + l.category + ' ' + l.steps.join(' '))
      .toLowerCase()
      .includes(norm),
  );
  const es = events.filter(
    (e) => e.petId === pet.id && (e.title + ' ' + e.note).toLowerCase().includes(norm),
  );
  return (
    <div className="search-detail">
      <label className="search-field">
        <MagnifyingGlassIcon size={22} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${pet.name}’s little world`}
        />
        {query && (
          <IconButton label="Clear search" onClick={() => setQuery('')}>
            <XIcon size={18} />
          </IconButton>
        )}
      </label>
      <p className="quiet-label">{norm ? 'WHAT WE FOUND' : 'A LITTLE INSPIRATION'}</p>
      {facts.length + lessons.length + es.length === 0 && (
        <div className="empty-state">
          <PawPrintIcon size={34} />
          <p>No matching moments yet. Try “food”, “play”, or “rest”.</p>
        </div>
      )}
      {facts.length > 0 && (
        <div className="search-group">
          <h4>Discoveries</h4>
          {facts.map((f) => (
            <button key={f.id} onClick={() => onFact(f)}>
              <span>
                <small>{f.category}</small>
                <strong>{f.title}</strong>
              </span>
              <ArrowUpRightIcon size={19} />
            </button>
          ))}
        </div>
      )}
      {lessons.length > 0 && (
        <div className="search-group">
          <h4>Training & connection</h4>
          {lessons.map((l) => (
            <button key={l.id} onClick={() => onLesson(l)}>
              <span>
                <small>
                  {l.duration} min · {l.category}
                </small>
                <strong>{l.title}</strong>
              </span>
              <PlayIcon size={19} />
            </button>
          ))}
        </div>
      )}
      {es.length > 0 && (
        <div className="search-group">
          <h4>Care moments</h4>
          {es.map((e) => (
            <button key={e.id} onClick={() => onEvent(e)}>
              <span>
                <small>
                  {e.time} · {e.repeat === 'daily' ? 'Daily' : e.date}
                </small>
                <strong>{e.title}</strong>
              </span>
              <ArrowUpRightIcon size={19} />
            </button>
          ))}
        </div>
      )}
      <SourceLink
        href={
          pet.species === 'dog'
            ? sources.dogDiet
            : pet.species === 'cat'
              ? sources.catCare
              : sources.rabbitCare
        }
      >
        Explore the PDSA pet care library
      </SourceLink>
    </div>
  );
}
