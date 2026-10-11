'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  PlusIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ForkKnifeIcon,
  FootprintsIcon,
  MoonIcon,
  BellIcon,
  TennisBallIcon,
  ClockIcon,
  PlantIcon,
  PlayIcon,
  SparkleIcon,
  PawPrintIcon,
  HeartIcon,
  SlidersHorizontalIcon,
  DownloadSimpleIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';
import { discoveryTitles, speciesNames } from '@/lib/species';
import { Animal, IconButton, haptic } from './shared';
import {
  ageLabel,
  careGuide,
  dateKey,
  eventsForDate,
  factsFor,
  lessonsFor,
  lifeStage,
  periodLabel,
  timeLabel,
  toMinutes,
  type Pet,
  type CareEvent,
  type Fact,
  type Lesson,
} from '@/lib/care';
const AmbientScene = dynamic(() => import('./ambient-scene'), {
  ssr: false,
  loading: () => (
    <div className="scene-fallback" aria-hidden="true">
      <span />
    </div>
  ),
});
export const eventIcons = {
  meal: ForkKnifeIcon,
  walk: FootprintsIcon,
  sleep: MoonIcon,
  play: TennisBallIcon,
  reminder: BellIcon,
};
export function EventRow({
  event,
  complete,
  onToggle,
  onOpen,
  compact = false,
}: {
  event: CareEvent;
  complete: boolean;
  onToggle: () => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  const Icon = eventIcons[event.kind];
  return (
    <div className={`event-row ${complete ? 'complete' : ''} ${compact ? 'compact' : ''}`}>
      <div className="event-time">
        {timeLabel(event.time)}
        <span>{periodLabel(event.time)}</span>
      </div>
      <div className={`event-symbol ${event.kind}`}>
        <Icon size={21} weight="regular" />
      </div>
      <button className="event-info" onClick={onOpen}>
        <strong>{event.title}</strong>
        <span>
          {event.duration} min ·{' '}
          {event.kind === 'meal'
            ? 'A balanced little moment'
            : event.kind === 'sleep'
              ? 'Time to recharge'
              : event.kind === 'reminder'
                ? 'Your reminder'
                : 'At their own pace'}
        </span>
      </button>
      <motion.button
        whileTap={{ scale: 0.78 }}
        animate={{ scale: complete ? [1, 1.22, 1] : 1 }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
        className={`completion-button ${complete ? 'checked' : ''}`}
        onClick={onToggle}
        aria-label={`${complete ? 'Undo' : 'Complete'} ${event.title}`}
        aria-pressed={complete}
      >
        <AnimatePresence>
          {complete && (
            <motion.span
              initial={{ scale: 0, rotate: -35 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
            >
              <CheckIcon size={15} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
export function Today({
  pet,
  events,
  completed,
  onToggle,
  onEvent,
  onFact,
  onDiet,
  onSchedule,
  onLesson,
  onAdd,
  isDemo,
  onPersonalize,
}: {
  pet: Pet;
  events: CareEvent[];
  completed: string[];
  onToggle: (event: CareEvent, date?: string) => void;
  onEvent: (event: CareEvent) => void;
  onFact: (fact: Fact) => void;
  onDiet: () => void;
  onSchedule: () => void;
  onLesson: (lesson: Lesson) => void;
  onAdd: () => void;
  isDemo: boolean;
  onPersonalize: () => void;
}) {
  const guide = careGuide(pet);
  const facts = factsFor(pet);
  const today = dateKey(new Date());
  const daily = eventsForDate(events, pet.id, today);
  const done = daily.filter((e) => completed.includes(`${today}:${e.id}`)).length;
  const next =
    daily.find(
      (e) =>
        !completed.includes(`${today}:${e.id}`) &&
        toMinutes(e.time) >= new Date().getHours() * 60 + new Date().getMinutes(),
    ) ?? daily.find((e) => !completed.includes(`${today}:${e.id}`));
  const firstLesson = lessonsFor(pet)[0];
  const fact = facts[0];
  return (
    <div className="today-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">
            {new Date()
              .toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
              .toUpperCase()}
          </span>
          <h1>
            Small moments.
            <br />
            <em>A happier {pet.name}.</em>
          </h1>
        </div>
        <div className="pet-chip">
          <span className="status-dot" />
          <span>
            {pet.breed === 'Unknown' ? speciesNames[pet.species] : pet.breed}
            <br />
            <small>
              {ageLabel(pet.ageMonths)} · Made for {pet.name}
            </small>
          </span>
        </div>
      </div>
      {isDemo && (
        <div className="demo-banner">
          <span>You’re exploring with {pet.name}. Make this little world your own.</span>
          <button onClick={onPersonalize}>
            Add your pet
            <ArrowRightIcon size={16} />
          </button>
        </div>
      )}
      <div className="today-top-grid">
        <motion.section className={`discovery-card ${pet.species}`} whileHover={{ y: -3 }}>
          <button
            className="discovery-card-hit"
            aria-label="Open today’s pet fact"
            onClick={() => onFact(fact)}
          />
          <div className="discovery-copy">
            <span className="eyebrow">
              <SparkleIcon size={15} />
              TODAY’S LITTLE DISCOVERY
            </span>
            <button className="fact-headline" onClick={() => onFact(fact)}>
              <h2>
                {discoveryTitles[pet.species][0]}
                <br />
                <em>{discoveryTitles[pet.species][1]}</em>
              </h2>
            </button>
            <p>{fact.teaser}</p>
            <button className="discovery-link" onClick={() => onFact(fact)}>
              Get to know {pet.name}
              <span>
                <ArrowUpRightIcon size={21} />
              </span>
            </button>
          </div>
          <div className="discovery-art">
            <span className="art-halo" />
            <AmbientScene />
            <Animal species={pet.species} breed={pet.breed} photo={pet.photo} interactive />
          </div>
          <span className="discovery-note">Tap to delight. Drag to play.</span>
        </motion.section>
        <section className="day-card">
          <div className="card-topline">
            <span className="eyebrow">A LITTLE EVERYDAY CARE</span>
            <HeartIcon size={19} />
          </div>
          <div className="progress-block">
            <div className="care-ring">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="ring-track" cx="50" cy="50" r="44" />
                <motion.circle
                  className="ring-progress"
                  cx="50"
                  cy="50"
                  r="44"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: daily.length ? done / daily.length : 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 80 }}
                />
              </svg>
              <strong>
                {done}
                <span>/{daily.length}</span>
              </strong>
            </div>
            <div>
              <h3>
                Good things
                <br />
                add up.
              </h3>
              <p>
                {done === daily.length
                  ? 'A lovely day, well cared for.'
                  : 'Little routines. Big love.'}
              </p>
            </div>
          </div>
          <div className="next-care">
            <span className="quiet-label">{next ? 'COMING UP NEXT' : 'ALL CAUGHT UP'}</span>
            {next ? (
              <button onClick={() => onEvent(next)}>
                <span className={`mini-event-symbol ${next.kind}`}>
                  {(() => {
                    const I = eventIcons[next.kind];
                    return <I size={20} />;
                  })()}
                </span>
                <span>
                  <strong>{next.title}</strong>
                  <small>
                    {timeLabel(next.time)} {periodLabel(next.time)} · {next.duration} min
                  </small>
                </span>
                <ArrowUpRightIcon size={19} />
              </button>
            ) : (
              <p>Make time for a little connection.</p>
            )}
          </div>
          <button className="card-footer-link" onClick={onSchedule}>
            See the whole day
            <ArrowRightIcon size={18} />
          </button>
        </section>
      </div>
      <div className="today-bottom-grid">
        <section className="routine-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THEIR DAILY RHYTHM</span>
              <h2>A good day, by the little things.</h2>
            </div>
            <IconButton label="Add a reminder" onClick={onAdd}>
              <PlusIcon size={21} />
            </IconButton>
          </div>
          <div className="routine-card">
            {daily.slice(0, 4).map((e) => (
              <EventRow
                key={e.id}
                event={e}
                complete={completed.includes(`${today}:${e.id}`)}
                onOpen={() => onEvent(e)}
                onToggle={() => onToggle(e)}
                compact
              />
            ))}
            <button className="routine-more" onClick={onSchedule}>
              View full schedule <ArrowRightIcon size={17} />
            </button>
          </div>
        </section>
        <section className="made-for-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THOUGHTFULLY TAILORED</span>
              <h2>Made for {pet.name}.</h2>
            </div>
          </div>
          <button className="mini-feature nutrition-feature" onClick={onDiet}>
            <div className="feature-icon">
              <PlantIcon size={27} />
            </div>
            <div>
              <span className="eyebrow">ON THE MENU</span>
              <h3>
                {pet.species === 'rabbit' ? 'Hay is the hero.' : 'A happier, healthier bowl.'}
              </h3>
              <p>
                {guide.meals} daily food checks · {lifeStage(pet)} care
              </p>
            </div>
            <ArrowUpRightIcon size={21} />
          </button>
          <button className="mini-feature training-feature" onClick={() => onLesson(firstLesson)}>
            <div className="feature-icon">
              <PawPrintIcon size={27} />
            </div>
            <div>
              <span className="eyebrow">GROW TOGETHER</span>
              <h3>{firstLesson.title}.</h3>
              <p>{firstLesson.duration} min · A little practice, a closer bond</p>
            </div>
            <ArrowUpRightIcon size={21} />
          </button>
        </section>
      </div>
      <div className="page-footnote">
        <span className="tiny-line" />A little care. A lot of love.
      </div>
    </div>
  );
}
export function Schedule({
  pet,
  events,
  completed,
  onToggle,
  onEvent,
  onAdd,
  onExport,
}: {
  pet: Pet;
  events: CareEvent[];
  completed: string[];
  onToggle: (event: CareEvent, date: string) => void;
  onEvent: (event: CareEvent) => void;
  onAdd: () => void;
  onExport: (date: Date) => void;
}) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selected, setSelected] = useState(new Date());
  const key = dateKey(selected);
  const daily = eventsForDate(events, pet.id, key);
  const today = dateKey(new Date());
  const changeDate = (dir: number) => {
    const d = new Date(selected);
    if (view === 'month') d.setMonth(d.getMonth() + dir, 1);
    else d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1));
    setSelected(d);
  };
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const month = Array.from(
    {
      length:
        Math.ceil(
          (new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate() + offset) / 7,
        ) * 7,
    },
    (_, i) => new Date(selected.getFullYear(), selected.getMonth(), i - offset + 1),
  );
  return (
    <div className="schedule-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ROOM FOR EVERY LITTLE THING</span>
          <h1>
            {pet.name}’s rhythm.
            <br />
            <em>A day well cared for.</em>
          </h1>
        </div>
        <button className="secondary-button desktop-action" onClick={onAdd}>
          <PlusIcon size={19} />
          Add reminder
        </button>
      </div>
      <section className="calendar-card">
        <div className="calendar-toolbar">
          <div className="calendar-month">
            <h2>{selected.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h2>
            <button className="plain-button" onClick={() => setSelected(new Date())}>
              Today
            </button>
          </div>
          <div className="view-segment" aria-label="Calendar view">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                className={view === v ? 'active' : ''}
                onClick={() => setView(v)}
                aria-pressed={view === v}
              >
                {view === v && (
                  <motion.span className="segment-highlight" layoutId="calendar-segment" />
                )}
                <span>{v[0].toUpperCase() + v.slice(1)}</span>
              </button>
            ))}
          </div>
          <div className="calendar-arrows">
            <IconButton label={`Previous ${view}`} onClick={() => changeDate(-1)}>
              <CaretLeftIcon size={20} />
            </IconButton>
            <IconButton label={`Next ${view}`} onClick={() => changeDate(1)}>
              <CaretRightIcon size={20} />
            </IconButton>
          </div>
        </div>
        {view !== 'month' && (
          <div className="week-strip">
            {week.map((d) => (
              <motion.button
                whileTap={{ scale: 0.94 }}
                key={dateKey(d)}
                className={`${dateKey(d) === key ? 'selected' : ''} ${dateKey(d) === today ? 'is-today' : ''}`}
                onClick={() => {
                  setSelected(d);
                  haptic();
                }}
                aria-label={d.toDateString()}
                aria-pressed={dateKey(d) === key}
              >
                {dateKey(d) === key && (
                  <motion.span
                    className="date-highlight"
                    layoutId="calendar-date"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span>{d.toLocaleDateString('en', { weekday: 'short' })}</span>
                <strong>{d.getDate()}</strong>
                <i />
              </motion.button>
            ))}
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {view === 'month' ? (
              <div className="month-calendar">
                <div className="month-weekdays">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="month-grid">
                  {month.map((d) => {
                    const dk = dateKey(d);
                    const es = eventsForDate(events, pet.id, dk);
                    return (
                      <button
                        key={dk}
                        className={`month-day ${d.getMonth() !== selected.getMonth() ? 'outside' : ''} ${dk === key ? 'selected' : ''} ${dk === today ? 'is-today' : ''}`}
                        onClick={() => {
                          setSelected(d);
                          setView('day');
                        }}
                      >
                        <strong>{d.getDate()}</strong>
                        <div className="month-indicators">
                          {es.slice(0, 3).map((e) => (
                            <i key={e.id} className={e.kind} />
                          ))}
                        </div>
                        <span className="month-event-count">{es.length} moments</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : view === 'week' ? (
              <div className="week-agenda">
                {week.map((d) => {
                  const dk = dateKey(d);
                  return (
                    <div className={`week-agenda-day ${dk === today ? 'is-today' : ''}`} key={dk}>
                      <h3>
                        {d.toLocaleDateString('en', { weekday: 'short' })}
                        <span>{d.getDate()}</span>
                      </h3>
                      {eventsForDate(events, pet.id, dk).map((e) => {
                        const I = eventIcons[e.kind];
                        return (
                          <button
                            className={`week-event ${e.kind} ${completed.includes(`${dk}:${e.id}`) ? 'is-done' : ''}`}
                            key={e.id}
                            onClick={() => {
                              setSelected(d);
                              setView('day');
                            }}
                          >
                            <I size={16} />
                            <span>
                              {timeLabel(e.time)} {periodLabel(e.time)}
                            </span>
                            <strong>{e.title}</strong>
                            <small>{e.duration} min</small>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="day-agenda">
                <div className="agenda-heading">
                  <h3>
                    {key === today
                      ? 'Today'
                      : selected.toLocaleDateString('en', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                    <span>{daily.length} little moments</span>
                  </h3>
                  <IconButton label="Add event or reminder" onClick={onAdd}>
                    <PlusIcon size={21} />
                  </IconButton>
                </div>
                {daily.length ? (
                  daily.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      complete={completed.includes(`${key}:${e.id}`)}
                      onOpen={() => onEvent(e)}
                      onToggle={() => onToggle(e, key)}
                    />
                  ))
                ) : (
                  <p className="empty-state">
                    A little space in the day. Add a reminder to get started.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="calendar-footer">
          <p>
            <SlidersHorizontalIcon size={17} />A starting rhythm, made to adapt. Tap any event to
            edit it.
          </p>
          <button className="plain-button" onClick={() => onExport(selected)}>
            <DownloadSimpleIcon size={17} />
            Add to your calendar
          </button>
        </div>
      </section>
      <div className="schedule-note">
        <MoonIcon size={23} />
        <div>
          <h3>Rest isn’t a rigid timetable.</h3>
          <p>{careGuide(pet).restBody}</p>
        </div>
      </div>
    </div>
  );
}
export function Training({
  pet,
  trained,
  onLesson,
}: {
  pet: Pet;
  trained: string[];
  onLesson: (lesson: Lesson) => void;
}) {
  const [filter, setFilter] = useState('All');
  const lessons = lessonsFor(pet);
  const categories = ['All', ...Array.from(new Set(lessons.map((l) => l.category)))];
  const practised = lessons.filter((l) => trained.includes(`${pet.id}:${l.id}`)).length;
  return (
    <div className="training-view">
      <div className="page-intro">
        <div>
          <span className="eyebrow">A LITTLE PRACTICE. A CLOSER BOND.</span>
          <h1>
            Learn their world.
            <br />
            <em>Grow together.</em>
          </h1>
        </div>
        <div className="training-progress">
          <span>
            <CheckCircleIcon size={23} />
          </span>
          <div>
            <strong>
              {practised} of {lessons.length}
            </strong>
            <small>lessons practised</small>
          </div>
        </div>
      </div>
      <section className="training-hero">
        <div>
          <span className="eyebrow">PICKED FOR {pet.name.toUpperCase()}</span>
          <h2>
            {pet.species === 'dog' ? (
              <>
                Good habits start
                <br />
                <em>with little moments.</em>
              </>
            ) : (
              <>
                Connection starts
                <br />
                <em>with understanding.</em>
              </>
            )}
          </h2>
          <p>
            {pet.species === 'dog'
              ? 'Kind, reward-based practice. At their own pace.'
              : 'Gentle enrichment and everyday confidence.'}
          </p>
          <button className="primary-button" onClick={() => onLesson(lessons[0])}>
            Let’s try it <ArrowRightIcon size={20} />
          </button>
        </div>
        <div className="training-hero-art">
          <Animal species={pet.species} breed={pet.breed} interactive photo={pet.photo} />
          <span className="floating-label">
            <ClockIcon size={16} />
            {lessons[0].duration} minutes of together
          </span>
        </div>
      </section>
      <div className="section-heading lesson-section-heading">
        <div>
          <span className="eyebrow">ONE SMALL STEP AT A TIME</span>
          <h2>Your learning collection.</h2>
        </div>
        <span className="quiet-label">
          {ageLabel(pet.ageMonths)} · {speciesNames[pet.species].toLowerCase()} learning
        </span>
      </div>
      <div className="filter-tabs">
        {categories.map((c) => (
          <motion.button
            key={c}
            className={filter === c ? 'selected' : ''}
            aria-pressed={filter === c}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              setFilter(c);
              haptic();
            }}
          >
            {c}
          </motion.button>
        ))}
      </div>
      <div className="lesson-grid">
        {lessons
          .filter((l) => filter === 'All' || l.category === filter)
          .map((lesson, i) => (
            <motion.button
              key={lesson.id}
              className={`lesson-card ${lesson.color}`}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onLesson(lesson)}
            >
              <div className="lesson-card-art">
                <span className="lesson-number">0{i + 1}</span>
                {lesson.id === 'leash' ? (
                  <FootprintsIcon size={76} weight="duotone" />
                ) : lesson.id === 'settle' || lesson.id === 'routine' ? (
                  <MoonIcon size={76} weight="duotone" />
                ) : lesson.id === 'play' || lesson.id === 'forage' ? (
                  <TennisBallIcon size={76} weight="duotone" />
                ) : lesson.id === 'carrier' || lesson.id === 'space' ? (
                  <HeartIcon size={76} weight="duotone" />
                ) : (
                  <PawPrintIcon size={76} weight="duotone" />
                )}
                <span className="lesson-play">
                  <PlayIcon size={20} weight="fill" />
                </span>
              </div>
              <div className="lesson-card-copy">
                <span className="eyebrow">{lesson.category.toUpperCase()}</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.subtitle}</p>
                <div>
                  <span>{lesson.duration} min · Guided practice</span>
                  {trained.includes(`${pet.id}:${lesson.id}`) && (
                    <CheckCircleIcon size={19} weight="fill" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
      </div>
      <p className="training-footnote">
        Keep sessions short and positive. Stop if your pet seems tired or uncomfortable.
      </p>
    </div>
  );
}
export function PetCollection({
  pets,
  activeId,
  onSelect,
  onAdd,
  onEdit,
}: {
  pets: Pet[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (pet: Pet) => void;
}) {
  const [index, setIndex] = useState(
    Math.max(
      0,
      pets.findIndex((p) => p.id === activeId),
    ),
  );
  const [direction, setDirection] = useState(1);
  const pet = pets[index];
  const move = (d: number) => {
    const next = Math.min(pets.length - 1, Math.max(0, index + d));
    if (next !== index) {
      haptic();
      setDirection(d);
      setIndex(next);
    }
  };
  return (
    <div className="pet-collection">
      <span className="eyebrow">YOUR LITTLE WORLD</span>
      <h1>
        All your love.
        <br />
        <em>In one place.</em>
      </h1>
      <p>One companion. A whole personality.</p>
      <div className="pet-carousel" aria-roledescription="carousel" aria-label="Your pets">
        <IconButton
          className="carousel-prev"
          label="Previous pet"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <CaretLeftIcon size={24} />
        </IconButton>
        <div className="carousel-viewport">
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={pet.id}
              custom={direction}
              className={`carousel-pet ${pet.species}`}
              initial={{ x: direction * 180, opacity: 0, scale: 0.8, borderRadius: '28%' }}
              animate={{ x: 0, opacity: 1, scale: 1, borderRadius: '50%' }}
              exit={{ x: -direction * 180, opacity: 0, scale: 0.75, borderRadius: '28%' }}
              transition={{ type: 'spring', stiffness: 230, damping: 26 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 35 || Math.abs(info.velocity.x) > 250)
                  move(info.offset.x > 0 ? -1 : 1);
              }}
              role="group"
              aria-label={`${index + 1} of ${pets.length}: ${pet.name}`}
            >
              <Animal species={pet.species} breed={pet.breed} photo={pet.photo} />
            </motion.div>
          </AnimatePresence>
          {index > 0 && (
            <div className="carousel-ghost ghost-left">
              <Animal
                species={pets[index - 1].species}
                breed={pets[index - 1].breed}
                photo={pets[index - 1].photo}
              />
            </div>
          )}
          {index < pets.length - 1 && (
            <div className="carousel-ghost ghost-right">
              <Animal
                species={pets[index + 1].species}
                breed={pets[index + 1].breed}
                photo={pets[index + 1].photo}
              />
            </div>
          )}
        </div>
        <IconButton
          className="carousel-next"
          label="Next pet"
          disabled={index === pets.length - 1}
          onClick={() => move(1)}
        >
          <CaretRightIcon size={24} />
        </IconButton>
      </div>
      <motion.div
        className="carousel-pet-caption"
        key={pet.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>{pet.name}</h2>
        <p aria-live="polite">
          {pet.breed === 'Unknown'
            ? 'A one-of-a-kind ' + speciesNames[pet.species].toLowerCase()
            : pet.breed}{' '}
          · {ageLabel(pet.ageMonths)}
        </p>
      </motion.div>
      <div className="carousel-dots" aria-label="Choose a companion">
        {pets.map((p, i) => (
          <button
            key={p.id}
            className={i === index ? 'active' : ''}
            aria-label={`View ${p.name}`}
            aria-pressed={i === index}
            onClick={() => {
              haptic();
              setDirection(i > index ? 1 : -1);
              setIndex(i);
            }}
          />
        ))}
      </div>
      <div className="pet-collection-actions">
        <button className="primary-button" onClick={() => onSelect(pet.id)}>
          Spend the day with {pet.name}
          <ArrowRightIcon size={20} />
        </button>
        <button className="plain-button" onClick={() => onEdit(pet)}>
          Edit {pet.name}’s profile <ArrowUpRightIcon size={16} />
        </button>
        <button className="secondary-button" onClick={onAdd}>
          <PlusIcon size={19} />
          Add another companion
        </button>
      </div>
    </div>
  );
}
