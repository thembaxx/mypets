'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CheckIcon,
  PlusIcon,
  ChartBarIcon,
  PawPrintIcon,
} from '@phosphor-icons/react';
import { careCount, recentDays, type HistoryEntry } from '@/lib/history';
import { dateKey, lessonsFor, type Pet, type Lesson } from '@/lib/care';
import { brandDirections } from '@/lib/brand';
import type { AppData } from '@/lib/storage';
import { BrandMark, IconButton, haptic } from './shared';

const displayDate = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
export function MonthCard({ data, pet, onOpen }: { data: AppData; pet: Pet; onOpen: () => void }) {
  const days = recentDays();
  const counts = days.map((date) => careCount(data, pet.id, date));
  const total = counts.reduce((sum, count) => sum + count, 0);
  const sessions =
    data.history?.filter(
      (entry) => entry.petId === pet.id && entry.kind === 'practice' && days.includes(entry.date),
    ).length ?? 0;
  return (
    <motion.button
      className="month-card"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      aria-label={`Review ${pet.name}’s last 30 days`}
    >
      <div className="month-card-copy">
        <span className="eyebrow">YOUR LITTLE HISTORY {data.demoMode && '· DEMO'}</span>
        <h2>A month of showing up.</h2>
        <p>
          {total
            ? `${total} care moments · ${sessions} practices · one very loved ${pet.name}.`
            : 'Every little moment has a place here. Start building your rhythm.'}
        </p>
      </div>
      <div className="month-sparkline" aria-hidden="true">
        {counts.map((count, index) => (
          <motion.span
            key={days[index]}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: index * 0.012, type: 'spring', stiffness: 120, damping: 17 }}
            style={{
              height: `${Math.max(8, (count / Math.max(1, ...counts)) * 100)}%`,
              opacity: count ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <span className="month-open">
        <ChartBarIcon size={23} />
      </span>
    </motion.button>
  );
}

export function MonthReview({
  data,
  pet,
  onAddNote,
  onLesson,
}: {
  data: AppData;
  pet: Pet;
  onAddNote: (entry: HistoryEntry) => void;
  onLesson: (lesson: Lesson) => void;
}) {
  const days = recentDays();
  const [selected, setSelected] = useState(days[days.length - 2]);
  const [filter, setFilter] = useState<'all' | 'practice' | 'note'>('all');
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const entries = (data.history ?? []).filter(
    (entry) => entry.petId === pet.id && days.includes(entry.date),
  );
  const counts = days.map((date) => careCount(data, pet.id, date));
  const active = counts.filter(
    (count, index) => count || entries.some((entry) => entry.date === days[index]),
  ).length;
  const selectedEntries = (data.history ?? [])
    .filter((entry) => entry.petId === pet.id)
    .filter((entry) => entry.date === selected && (filter === 'all' || entry.kind === filter));
  const completeIds = new Set(
    data.completed
      .filter((key) => key.startsWith(selected + ':'))
      .map((key) => key.slice(selected.length + 1)),
  );
  const completed = data.events.filter(
    (event) => event.petId === pet.id && completeIds.has(event.id),
  );
  return (
    <div className="month-review">
      <span className="eyebrow">
        {displayDate(days[0])} — {displayDate(days[days.length - 1])}
      </span>
      <h3>Little moments, remembered.</h3>
      <p>A look at {pet.name}’s care, learning, and the things you noticed along the way.</p>
      {data.demoMode && (
        <p className="history-demo">
          A seeded example month. These are sample records for exploring the app.
        </p>
      )}
      <div className="history-stats">
        <div>
          <strong>{counts.reduce((sum, count) => sum + count, 0)}</strong>
          <span>care moments</span>
        </div>
        <div>
          <strong>{entries.filter((entry) => entry.kind === 'practice').length}</strong>
          <span>practices</span>
        </div>
        <div>
          <strong>{active}</strong>
          <span>days with a record</span>
        </div>
      </div>
      <div
        className="history-chart"
        role="group"
        aria-label="Daily care history"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          const index = Math.min(
            days.length - 1,
            Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * days.length)),
          );
          setSelected(days[index]);
          setExpanded(null);
          haptic();
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const index = Math.min(
            days.length - 1,
            Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * days.length)),
          );
          setSelected(days[index]);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        {days.map((date, index) => (
          <motion.button
            key={date}
            className={selected === date ? 'selected' : ''}
            onClick={() => {
              setSelected(date);
              setExpanded(null);
              haptic();
            }}
            aria-label={`${displayDate(date)}: ${counts[index]} care moments`}
            aria-pressed={selected === date}
            whileTap={{ scale: 0.9 }}
          >
            <motion.span
              initial={{ height: 4 }}
              animate={{ height: `${Math.max(5, (counts[index] / Math.max(1, ...counts)) * 90)}%` }}
              transition={{ type: 'spring', stiffness: 130, damping: 20, delay: index * 0.007 }}
            />
          </motion.button>
        ))}
      </div>
      <div className="chart-axis">
        <span>{displayDate(days[0])}</span>
        <span>Tap or drag to explore</span>
        <span>{displayDate(days[days.length - 1])}</span>
      </div>
      <div className="history-date">
        <label className="form-label">
          Your day
          <input
            type="date"
            value={selected}
            max={dateKey(new Date())}
            onChange={(event) => {
              if (event.target.value) setSelected(event.target.value);
            }}
          />
        </label>
        <IconButton
          label={writing ? 'Close note editor' : 'Add a journal note'}
          onClick={() => {
            setWriting(!writing);
            setNote('');
          }}
        >
          <PlusIcon size={23} style={{ transform: writing ? 'rotate(45deg)' : undefined }} />
        </IconButton>
      </div>
      <AnimatePresence>
        {writing && (
          <motion.form
            className="journal-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              onAddNote({
                id: crypto.randomUUID(),
                petId: pet.id,
                date: selected,
                kind: 'note',
                title: 'A little observation',
                note: note.trim(),
              });
              setWriting(false);
              setNote('');
              haptic(true);
            }}
          >
            <label className="form-label">
              What did you notice?
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1200}
                rows={3}
                required
                placeholder={`A good moment with ${pet.name}…`}
              />
            </label>
            <button
              className="icon-button primary-icon"
              type="submit"
              aria-label="Save journal note"
              title="Save journal note"
            >
              <CheckIcon size={24} />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <div className="filter-tabs" role="group" aria-label="History type">
        {(['all', 'practice', 'note'] as const).map((kind) => (
          <button
            key={kind}
            className={filter === kind ? 'active' : ''}
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind)}
          >
            {kind === 'all' ? 'Everything' : kind === 'practice' ? 'Practice' : 'Journal'}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selected}-${filter}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="history-entries"
        >
          <h4>{displayDate(selected)}</h4>
          {filter === 'all' && completed.length > 0 && (
            <div className="history-care">
              <CheckIcon size={21} />
              <div>
                <strong>{completed.length} care moments logged</strong>
                <p>{completed.map((event) => event.title).join(' · ')}</p>
              </div>
            </div>
          )}
          {selectedEntries.map((entry) => (
            <motion.article className="history-entry" key={entry.id} layout>
              <button
                className="history-entry-toggle"
                aria-expanded={expanded === entry.id}
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className="history-entry-icon">
                  {entry.kind === 'practice' ? (
                    <PawPrintIcon size={22} />
                  ) : (
                    <BookOpenIcon size={22} />
                  )}
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.kind === 'practice' ? `${entry.minutes ?? 0} min · Practice` : 'Journal'}
                    {entry.id.startsWith('demo-') && ' · Sample'}
                  </small>
                </span>
                <ArrowUpRightIcon size={20} />
              </button>
              <AnimatePresence>
                {expanded === entry.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="history-entry-body"
                  >
                    <p>{entry.note}</p>
                    {entry.kind === 'practice' && (
                      <IconButton
                        label={`Practise ${entry.title} again`}
                        onClick={() => {
                          const lesson = lessonsFor(pet).find((item) => item.id === entry.lessonId);
                          if (lesson) onLesson(lesson);
                        }}
                      >
                        <PawPrintIcon size={22} />
                      </IconButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          ))}
          {!selectedEntries.length && (filter !== 'all' || !completed.length) && (
            <p className="empty-state">
              Nothing logged here yet. A quiet day has room for a little observation.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function BrandStudio() {
  const [active, setActive] = useState(0);
  const direction = brandDirections[active];
  return (
    <div className="brand-studio">
      <span className="eyebrow">THREE WAYS TO FEEL AT HOME</span>
      <h3>A name for their little world.</h3>
      <p>Explore the identity directions. Nuzzle is the working identity throughout the app.</p>
      <div className="brand-options" role="group" aria-label="Brand directions">
        {brandDirections.map((item, index) => (
          <motion.button
            key={item.key}
            aria-label={`Preview ${item.name}`}
            aria-pressed={active === index}
            onClick={() => {
              setActive(index);
              haptic();
            }}
            whileHover={{ y: -6, rotate: index === 1 ? 3 : -3 }}
            whileTap={{ scale: 0.94 }}
          >
            <BrandMark direction={item.key} />
            <strong>{item.name}</strong>
            {active === index && (
              <motion.span className="brand-option-dot" layoutId="brand-choice" />
            )}
          </motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={direction.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="brand-story"
        >
          <h2>{direction.line}</h2>
          <p>{direction.description}</p>
        </motion.div>
      </AnimatePresence>
      <img
        src="/brand/directions.webp"
        alt="Nuzzle, Pippa and Kindred: three sculpted app icon concepts"
        className="brand-board"
      />
      <p className="fine-print">
        Creative naming directions. Name and trademark availability have not been verified.
      </p>
      <a className="source-link" href="/icons/icon.svg" download="nuzzle-icon.svg">
        Download the Nuzzle vector mark
        <ArrowUpRightIcon size={18} />
      </a>
    </div>
  );
}
