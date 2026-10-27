'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  HouseIcon,
  CalendarDotsIcon,
  PawPrintIcon,
  MagnifyingGlassIcon,
  DotsThreeIcon,
  ArrowLeftIcon,
  CheckIcon,
  DownloadSimpleIcon,
  ShareNetworkIcon,
  WifiSlashIcon,
  XIcon,
  SunIcon,
  MoonIcon,
  DeviceMobileIcon,
  ChatCircleDotsIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import { AssistantEntry } from './assistant-entry';
import Onboarding from './onboarding';
import LaunchSplash from './launch-splash';
import { MonthCard, MonthReview, BrandStudio } from './history';
import { createDemoData } from '@/lib/history';
import { brand } from '@/lib/brand';
import {
  AnimalAnimationContext,
  Brand,
  IconButton,
  Sheet,
  SoundToggle,
  haptic,
  playTone,
} from './shared';
import { Today, Schedule, Training, PetCollection } from './views';
import { DietDetail, EventEditor, FactDetail, LessonDetail, SearchDetail } from './details';
import {
  calendarExport,
  dateKey,
  defaultEvents,
  eventOccursOnDate,
  demoPets,
  type Pet,
  type CareEvent,
  type Fact,
  type Lesson,
} from '@/lib/care';
import { applyAppearance } from '@/lib/appearance';
import { readData, STORAGE_KEY, type Appearance, type AppData } from '@/lib/storage';
import { CaregiverHandoff } from './caregiver-handoff';
type Tab = 'today' | 'schedule' | 'training';
type Detail =
  | { type: 'fact'; fact: Fact }
  | { type: 'diet' }
  | { type: 'event'; event?: CareEvent }
  | { type: 'lesson'; lesson: Lesson }
  | { type: 'search' }
  | { type: 'settings' }
  | { type: 'history' }
  | { type: 'brand' }
  | { type: 'handoff' };
type AssistantDetail = { type: 'assistant'; prompt?: string; panel?: 'chat' | 'model' };
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const initialData: AppData & { demoMode?: boolean } = {
  version: 1,
  pets: demoPets,
  activePetId: 'milo',
  events: demoPets.flatMap(defaultEvents),
  completed: [],
  trained: [],
  onboarded: false,
  sound: false,
  demoMode: true,
  appearance: 'system',
  animalAnimations: true,
};
const OfflineAssistant = dynamic(() => import('./offline-assistant'), {
  ssr: false,
  loading: () => (
    <p className="assistant-notice" role="status">
      Opening your companion…
    </p>
  ),
});
export default function PetApp() {
  const [data, setData] = useState(initialData);
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(true);
  const finishLaunch = useCallback(() => setLaunching(false), []);
  const [tab, setTab] = useState<Tab>('today');
  const [page, setPage] = useState<'main' | 'pets' | 'onboard'>('main');
  const [detail, setDetail] = useState<Detail | AssistantDetail | null>(null);
  const [editPet, setEditPet] = useState<Pet | undefined>();
  const [toast, setToast] = useState('');
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [storageError, setStorageError] = useState(false);
  const notificationKeys = useRef(new Set<string>());
  const scrollPositions = useRef<Record<Tab, number>>({ today: 0, schedule: 0, training: 0 });
  const historyReady = useRef(false);
  const pet = data.pets.find((p) => p.id === data.activePetId) ?? data.pets[0];
  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);
  useEffect(() => {
    const saved = readData();
    setData(saved ?? createDemoData());
    const params = new URLSearchParams(location.search);
    const t = params.get('tab');
    if (t === 'today' || t === 'schedule' || t === 'training') setTab(t);
    setOffline(!navigator.onLine);
    setReady(true);
    window.history.replaceState(
      { tab: t || 'today', page: 'main', detail: null },
      '',
      location.pathname + (t ? `?tab=${t}` : ''),
    );
    historyReady.current = true;
    const pop = (e: PopStateEvent) => {
      setTab(e.state?.tab ?? 'today');
      setPage(e.state?.page ?? 'main');
      setDetail(e.state?.detail ?? null);
    };
    const online = () => setOffline(!navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('beforeinstallprompt', prompt);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data, ready]);
  useEffect(() => {
    if (!ready) return;
    const appearance = data.appearance ?? 'system';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyAppearance(appearance);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [data.appearance, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const now = new Date();
      const key = dateKey(now);
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      for (const event of data.events.filter(
        (e) => e.notify && e.time === time && eventOccursOnDate(e, key),
      )) {
        const nkey = `${key}:${event.id}`;
        if (notificationKeys.current.has(nkey) || data.completed.includes(nkey)) continue;
        notificationKeys.current.add(nkey);
        const owner = data.pets.find((p) => p.id === event.petId);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
          navigator.serviceWorker
            ?.getRegistration()
            .then((reg) => {
              if (reg)
                return reg.showNotification(`${owner?.name ?? 'Your pet'} · ${event.title}`, {
                  body: event.note || 'A little care moment is ready.',
                  icon: '/icons/icon-192.png',
                  tag: nkey,
                });
              new Notification(event.title, { body: event.note });
            })
            .catch(() => {
              new Notification(event.title);
            });
        notify(`Time for ${owner?.name ?? 'your pet'}’s ${event.title.toLowerCase()}.`);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [data, ready, notify]);
  const pushState = (
    nextPage = page,
    nextDetail: Detail | AssistantDetail | null = detail,
    nextTab = tab,
  ) => {
    if (!historyReady.current) return;
    const params = new URLSearchParams({ tab: nextTab });
    if (nextPage !== 'main') params.set('view', nextPage);
    if (nextDetail) params.set('detail', nextDetail.type);
    window.history.pushState(
      { tab: nextTab, page: nextPage, detail: nextDetail },
      '',
      `?${params}`,
    );
  };
  const openDetail = (d: Detail | AssistantDetail) => {
    if (detail) {
      setDetail(d);
      window.history.replaceState({ tab, page, detail: d }, '', `?tab=${tab}&detail=${d.type}`);
    } else {
      pushState(page, d);
      setDetail(d);
    }
    haptic();
  };
  const closeDetail = () => {
    setDetail(null);
    window.history.back();
  };
  const navigate = (t: Tab) => {
    if (t === tab) return;
    scrollPositions.current[tab] = window.scrollY;
    pushState('main', null, t);
    setTab(t);
    setPage('main');
    setDetail(null);
    haptic();
    requestAnimationFrame(() =>
      window.scrollTo({ top: scrollPositions.current[t], behavior: 'instant' }),
    );
  };
  const openPets = () => {
    pushState('pets', null);
    setPage('pets');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const leavePets = () => {
    setPage('main');
    window.history.back();
  };
  const addPet = () => {
    setEditPet(undefined);
    pushState('onboard', null);
    setPage('onboard');
  };
  const savePet = (saved: Pet) => {
    setData((previous) => {
      const replace = previous.demoMode && !editPet;
      const exists = previous.pets.some((p) => p.id === saved.id);
      const pets = replace
        ? [saved]
        : exists
          ? previous.pets.map((p) => (p.id === saved.id ? saved : p))
          : [...previous.pets, saved];
      const oldEvents = replace ? [] : previous.events.filter((e) => e.petId !== saved.id);
      const customEvents = replace
        ? []
        : previous.events.filter((e) => e.petId === saved.id && !e.id.startsWith(saved.id + '-'));
      const events = [...oldEvents, ...defaultEvents(saved), ...customEvents];
      return {
        ...previous,
        pets,
        events,
        activePetId: saved.id,
        onboarded: true,
        demoMode: false,
        completed: replace ? [] : previous.completed,
        trained: replace ? [] : previous.trained,
        history: replace ? [] : previous.history,
      };
    });
    setPage('main');
    setTab('today');
    setDetail(null);
    setEditPet(undefined);
    window.history.replaceState({ tab: 'today', page: 'main', detail: null }, '', '?tab=today');
    window.scrollTo({ top: 0, behavior: 'instant' });
    haptic(true);
    notify(`A little world, made for ${saved.name}.`);
  };
  const toggle = (event: CareEvent, date = dateKey(new Date())) => {
    const key = `${date}:${event.id}`;
    const wasComplete = data.completed.includes(key);
    setData((prev) => ({
      ...prev,
      completed: wasComplete ? prev.completed.filter((k) => k !== key) : [...prev.completed, key],
    }));
    haptic(!wasComplete);
    if (data.sound && !wasComplete) playTone();
  };
  const saveEvent = (event: CareEvent) => {
    setData((prev) => ({
      ...prev,
      events: prev.events.some((e) => e.id === event.id)
        ? prev.events.map((e) => (e.id === event.id ? event : e))
        : [...prev.events, event],
    }));
    notify('A little moment, saved.');
  };
  const deleteEvent = (id: string) => {
    setData((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== id) }));
    notify('Event removed from the schedule.');
  };
  const exportCalendar = (date: Date) => {
    const content = calendarExport(
      data.events.filter((e) => e.petId === pet.id),
      pet,
      date,
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pet.name.toLowerCase()}-care.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    notify('Calendar downloaded. Open it in your calendar app.');
  };
  const share = async () => {
    const shareData = {
      title: brand.name,
      text: `A little care. A lot of love. ${pet.name}’s everyday companion.`,
      url: location.origin,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        notify('App link copied.');
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') notify('The link could not be shared.');
    }
  };
  const exportBackup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nuzzle-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  if (!ready || launching) return <LaunchSplash ready={ready} onComplete={finishLaunch} />;
  if (!data.onboarded || page === 'onboard')
    return (
      <MotionConfig reducedMotion="user">
        <AnimalAnimationContext.Provider value={data.animalAnimations !== false}>
          <Onboarding
            initial={editPet}
            onSave={savePet}
            onExplore={() => {
              setData((p) => ({ ...p, onboarded: true, demoMode: true }));
              notify(`Meet ${demoPets.length} little companions. Explore their different worlds.`);
            }}
            onClose={
              data.onboarded
                ? () => {
                    setPage(editPet ? 'pets' : 'main');
                    window.history.back();
                  }
                : undefined
            }
          />
        </AnimalAnimationContext.Provider>
      </MotionConfig>
    );
  const detailTitle =
    detail?.type === 'handoff'
      ? 'Caregiver handoff'
      : detail?.type === 'fact'
        ? 'A little discovery'
        : detail?.type === 'diet'
          ? `${pet.name}’s bowl`
          : detail?.type === 'event'
            ? detail.event
              ? 'A care moment'
              : 'Make a little room'
            : detail?.type === 'lesson'
              ? 'Grow together'
              : detail?.type === 'search'
                ? 'Find a little something'
                : detail?.type === 'history'
                  ? `${pet.name}’s little history`
                  : detail?.type === 'brand'
                    ? 'The identity studio'
                    : detail?.type === 'assistant'
                      ? `Ask about ${pet.name}`
                      : 'Make it yours';
  return (
    <MotionConfig reducedMotion="user">
      <AnimalAnimationContext.Provider value={data.animalAnimations !== false}>
        <div className={`app-shell ${detail ? 'has-sheet' : ''}`}>
          <header className="app-header">
            <div className="header-left">
              {page === 'pets' ? (
                <IconButton label="Back to your day" onClick={leavePets}>
                  <ArrowLeftIcon size={23} />
                </IconButton>
              ) : (
                <button
                  className="brand-button"
                  onClick={() => navigate('today')}
                  aria-label="Nuzzle home"
                >
                  <Brand />
                </button>
              )}
              <span className="header-context">
                {page === 'pets' ? 'Your companions' : 'Their everyday companion'}
              </span>
            </div>
            <div className="header-actions">
              <IconButton
                label="Ask your pet companion"
                onClick={() => openDetail({ type: 'assistant' })}
              >
                <ChatCircleDotsIcon size={23} />
              </IconButton>
              <IconButton label="Search" onClick={() => openDetail({ type: 'search' })}>
                <MagnifyingGlassIcon size={23} />
              </IconButton>
              <IconButton
                label="Your pets"
                className={page === 'pets' ? 'header-pets active' : 'header-pets'}
                onClick={page === 'pets' ? leavePets : openPets}
              >
                <PawPrintIcon size={24} weight={page === 'pets' ? 'fill' : 'regular'} />
              </IconButton>
              <IconButton
                label="App preferences"
                className="preferences-button"
                onClick={() => openDetail({ type: 'settings' })}
              >
                <DotsThreeIcon size={25} weight="bold" />
              </IconButton>
            </div>
          </header>
          {offline && (
            <div className="system-banner">
              <WifiSlashIcon size={17} />
              You’re offline. Your saved little world is still here.
            </div>
          )}
          {storageError && (
            <div className="system-banner storage-warning">
              This device’s storage is full. Your latest changes are temporary.
              <button onClick={exportBackup}>Download a backup</button>
            </div>
          )}
          <main className="app-main">
            <AnimatePresence mode="wait">
              <motion.div
                key={page === 'pets' ? 'pets' : tab}
                initial={{ opacity: 0, y: 12, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {page === 'pets' ? (
                  <PetCollection
                    pets={data.pets}
                    activeId={pet.id}
                    onSelect={(id) => {
                      setData((prev) => ({ ...prev, activePetId: id }));
                      leavePets();
                      haptic();
                    }}
                    onAdd={addPet}
                    onEdit={(p) => {
                      setEditPet(p);
                      pushState('onboard', null);
                      setPage('onboard');
                    }}
                  />
                ) : tab === 'today' ? (
                  <Today
                    pet={pet}
                    events={data.events}
                    completed={data.completed}
                    onToggle={toggle}
                    onEvent={(event) => openDetail({ type: 'event', event })}
                    onFact={(fact) => openDetail({ type: 'fact', fact })}
                    onDiet={() => openDetail({ type: 'diet' })}
                    onSchedule={() => navigate('schedule')}
                    onLesson={(lesson) => openDetail({ type: 'lesson', lesson })}
                    onAdd={() => openDetail({ type: 'event' })}
                    isDemo={!!data.demoMode}
                    onPersonalize={addPet}
                    historyCard={
                      <>
                        <AssistantEntry
                          pet={pet}
                          onOpen={() => openDetail({ type: 'assistant' })}
                        />
                        <MonthCard
                          data={data}
                          pet={pet}
                          onOpen={() => openDetail({ type: 'history' })}
                        />
                      </>
                    }
                  />
                ) : tab === 'schedule' ? (
                  <Schedule
                    pet={pet}
                    events={data.events}
                    completed={data.completed}
                    onToggle={toggle}
                    onEvent={(event) => openDetail({ type: 'event', event })}
                    onAdd={() => openDetail({ type: 'event' })}
                    onExport={exportCalendar}
                  />
                ) : (
                  <Training
                    pet={pet}
                    trained={data.trained}
                    onLesson={(lesson) => openDetail({ type: 'lesson', lesson })}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          {page === 'main' && (
            <nav className="bottom-dock" aria-label="Main navigation">
              {(
                [
                  { id: 'today', label: 'Today', Icon: HouseIcon },
                  { id: 'schedule', label: 'Schedule', Icon: CalendarDotsIcon },
                  { id: 'training', label: 'Training', Icon: PawPrintIcon },
                ] as const
              ).map(({ id, label, Icon }) => (
                <motion.button
                  key={id}
                  className={`dock-item ${tab === id ? 'active' : ''}`}
                  onClick={() => navigate(id)}
                  aria-label={label}
                  title={label}
                  aria-current={tab === id ? 'page' : undefined}
                  whileTap={{ scale: 0.85 }}
                >
                  {tab === id && (
                    <motion.span
                      className="dock-active"
                      layoutId="dock-selection"
                      transition={{ type: 'spring', damping: 23, stiffness: 330 }}
                    />
                  )}
                  <motion.span
                    className="dock-icon"
                    animate={{ scale: tab === id ? [0.9, 1.12, 1] : 1, y: 0 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                  >
                    <Icon size={27} weight={tab === id ? 'fill' : 'regular'} />
                  </motion.span>
                </motion.button>
              ))}
            </nav>
          )}
        </div>
        <Sheet
          open={!!detail}
          title={detailTitle}
          onClose={closeDetail}
          variant={
            detail?.type === 'assistant'
              ? 'assistant'
              : detail?.type === 'event'
                ? 'event'
                : 'default'
          }
        >
          {detail?.type === 'handoff' ? (
            <CaregiverHandoff data={data} petId={pet.id} />
          ) : detail?.type === 'fact' ? (
            <FactDetail
              key={detail.fact.id}
              pet={pet}
              fact={detail.fact}
              onFact={(fact) => openDetail({ type: 'fact', fact })}
            />
          ) : detail?.type === 'diet' ? (
            <DietDetail pet={pet} />
          ) : detail?.type === 'event' ? (
            <EventEditor
              key={detail.event?.id ?? 'new-event'}
              event={detail.event}
              pet={pet}
              onSave={saveEvent}
              onDelete={deleteEvent}
              onClose={closeDetail}
            />
          ) : detail?.type === 'lesson' ? (
            <LessonDetail
              key={`${pet.id}-${detail.lesson.id}`}
              pet={pet}
              lesson={detail.lesson}
              completed={data.trained.includes(`${pet.id}:${detail.lesson.id}`)}
              sound={data.sound}
              onAsk={() =>
                openDetail({
                  type: 'assistant',
                  prompt: `Help me practise ${detail.lesson.title}.`,
                })
              }
              onComplete={() => {
                setData((prev) => ({
                  ...prev,
                  trained: Array.from(new Set([...prev.trained, `${pet.id}:${detail.lesson.id}`])),
                  history: [
                    ...(prev.history ?? []),
                    {
                      id: crypto.randomUUID(),
                      petId: pet.id,
                      date: dateKey(new Date()),
                      kind: 'practice' as const,
                      title: detail.lesson.title,
                      note: 'A little time spent growing together.',
                      minutes: detail.lesson.duration,
                      lessonId: detail.lesson.id,
                    },
                  ],
                }));
                haptic(true);
                if (data.sound) playTone();
                notify('A little closer, one practice at a time.');
                closeDetail();
              }}
            />
          ) : detail?.type === 'search' ? (
            <SearchDetail
              pet={pet}
              events={data.events}
              onFact={(fact) => openDetail({ type: 'fact', fact })}
              onLesson={(lesson) => openDetail({ type: 'lesson', lesson })}
              onEvent={(event) => openDetail({ type: 'event', event })}
            />
          ) : detail?.type === 'history' ? (
            <MonthReview
              data={data}
              pet={pet}
              onSummarize={() =>
                openDetail({ type: 'assistant', prompt: 'Summarize our last month.' })
              }
              onAddNote={(entry) => {
                setData((previous) => ({
                  ...previous,
                  history: [...(previous.history ?? []), entry],
                }));
                notify('An observation, kept close.');
              }}
              onLesson={(lesson) => openDetail({ type: 'lesson', lesson })}
            />
          ) : detail?.type === 'brand' ? (
            <BrandStudio />
          ) : detail?.type === 'assistant' ? (
            <OfflineAssistant
              key={`${pet.id}:${detail.prompt ?? ''}:${detail.panel ?? 'chat'}`}
              data={data}
              pet={pet}
              initialPrompt={detail.prompt}
              initialPanel={detail.panel}
              onSaveReminder={saveEvent}
              onLesson={(lesson) => openDetail({ type: 'lesson', lesson })}
            />
          ) : detail?.type === 'settings' ? (
            <div className="settings-detail">
              <Brand />
              <h3>Little things, your way.</h3>
              <p>A calmer everyday companion.</p>
              <p>
                <a href="/about/">About Nuzzle, sources & privacy</a>
              </p>
              <div className="settings-row">
                <div>
                  <strong>Offline companion</strong>
                  <span>Model downloads, device storage, and private conversations.</span>
                </div>
                <IconButton
                  label="Manage offline companion"
                  onClick={() => openDetail({ type: 'assistant', panel: 'model' })}
                >
                  <SparkleIcon size={22} />
                </IconButton>
              </div>
              <div className="settings-row">
                <div>
                  <strong>A little identity</strong>
                  <span>Nuzzle, Pippa, and Kindred. Explore the directions.</span>
                </div>
                <IconButton
                  label="Explore brand directions"
                  onClick={() => openDetail({ type: 'brand' })}
                >
                  <PawPrintIcon size={22} />
                </IconButton>
              </div>
              <div className="settings-row">
                <div>
                  <strong>A month of little moments</strong>
                  <span>Care, practice, and observations for {pet.name}.</span>
                </div>
                <IconButton
                  label="Open care history"
                  onClick={() => openDetail({ type: 'history' })}
                >
                  <CalendarDotsIcon size={22} />
                </IconButton>
              </div>
              <div className="appearance-settings">
                <strong>Appearance</strong>
                <p>Follow your device, or choose your own.</p>
                <div className="appearance-segment" role="group" aria-label="Appearance">
                  {(
                    [
                      { id: 'system', label: 'System', Icon: DeviceMobileIcon },
                      { id: 'light', label: 'Light', Icon: SunIcon },
                      { id: 'dark', label: 'Dark', Icon: MoonIcon },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <motion.button
                      key={id}
                      aria-label={label}
                      title={label}
                      aria-pressed={(data.appearance ?? 'system') === id}
                      onClick={() => {
                        setData((previous) => ({ ...previous, appearance: id as Appearance }));
                        haptic();
                      }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {(data.appearance ?? 'system') === id && (
                        <motion.span
                          className="appearance-highlight"
                          layoutId="appearance-selection"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon
                        size={21}
                        weight={(data.appearance ?? 'system') === id ? 'fill' : 'regular'}
                      />
                      <span className="sr-only">{label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Playful animal illustrations</strong>
                  <span>
                    {data.animalAnimations === false
                      ? 'Original illustrations, completely still.'
                      : 'Gentle movement, little reactions and drag to play.'}
                  </span>
                </div>
                <button
                  type="button"
                  className={'text-toggle ' + (data.animalAnimations !== false ? 'on' : '')}
                  role="switch"
                  aria-checked={data.animalAnimations !== false}
                  aria-label="Playful animal illustrations"
                  onClick={() => {
                    setData((previous) => ({
                      ...previous,
                      animalAnimations: previous.animalAnimations === false,
                    }));
                    haptic();
                  }}
                >
                  {data.animalAnimations === false ? 'Static' : 'Animated'}
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Gentle sounds</strong>
                  <span>A soft note for a completed moment.</span>
                </div>
                <SoundToggle
                  enabled={data.sound}
                  onToggle={() => {
                    setData((p) => ({ ...p, sound: !p.sound }));
                    if (!data.sound) playTone();
                  }}
                />
              </div>
              <div className="settings-row">
                <div>
                  <strong>On your home screen</strong>
                  <span>Your little world, one tap away.</span>
                </div>
                <IconButton
                  label="Install Nuzzle"
                  onClick={() => {
                    if (install) {
                      void install.prompt();
                      setInstall(null);
                    } else
                      notify(
                        'On iPhone: Share → Add to Home Screen. On other browsers, choose Install app from the menu.',
                      );
                  }}
                >
                  <DownloadSimpleIcon size={22} />
                </IconButton>
              </div>
              <p className="fine-print">
                On iPhone or iPad, open Safari’s Share menu and choose Add to Home Screen. The app
                respects your appearance choice and reduced motion settings.
              </p>
              <div className="settings-row">
                <div>
                  <strong>Keep your rhythm close</strong>
                  <span>Export {pet.name}’s care schedule.</span>
                </div>
                <IconButton label="Export calendar" onClick={() => exportCalendar(new Date())}>
                  <CalendarDotsIcon size={22} />
                </IconButton>
              </div>
              <p className="fine-print">
                Browser notifications work while this app is open. Device calendars can remind you
                while it’s closed.
              </p>
              <div className="settings-row">
                <div>
                  <strong>Caregiver handoff</strong>
                  <span>Review recent care and upcoming tasks for {pet.name}.</span>
                </div>
                <IconButton
                  label="Prepare caregiver handoff"
                  onClick={() => openDetail({ type: 'handoff' })}
                >
                  <ShareNetworkIcon size={22} />
                </IconButton>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Share a little love</strong>
                  <span>Send someone the app.</span>
                </div>
                <IconButton
                  label="Share Nuzzle"
                  onClick={() => {
                    void share();
                  }}
                >
                  <ShareNetworkIcon size={22} />
                </IconButton>
              </div>
              <div className="settings-row">
                <div>
                  <strong>A copy of your little world</strong>
                  <span>Back up your pets and routines.</span>
                </div>
                <IconButton label="Download your pet data" onClick={exportBackup}>
                  <DownloadSimpleIcon size={22} />
                </IconButton>
              </div>
              <p className="fine-print">
                Your pets, photos, and progress are saved in this browser. Clearing browser data
                removes them. Care information is a starting point; your vet can tailor it to their
                health.
              </p>
            </div>
          ) : null}
        </Sheet>
        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              style={{ x: '-50%' }}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <CheckIcon size={18} />
              <span>{toast}</span>
              <button onClick={() => setToast('')} aria-label="Dismiss message">
                <XIcon size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimalAnimationContext.Provider>
    </MotionConfig>
  );
}
