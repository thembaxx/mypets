import { defaultEvents, demoPets, type CareEvent, type Pet } from './care';
import { speciesList } from './species';
import { seedDemoHistory, type HistoryEntry } from './history';
export type Appearance = 'system' | 'light' | 'dark';
export interface AppData {
  version: 1;
  pets: Pet[];
  activePetId: string;
  events: CareEvent[];
  completed: string[];
  trained: string[];
  onboarded: boolean;
  sound: boolean;
  demoMode?: boolean;
  appearance?: Appearance;
  history?: HistoryEntry[];
  demoSeedVersion?: 1;
}
export const STORAGE_KEY = 'mypets-v1';
export function parseData(raw: string): AppData | null {
  try {
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Array.isArray(data.pets) ||
      !data.pets.length ||
      !Array.isArray(data.events)
    )
      return null;
    if (
      !data.pets.every(
        (pet: Pet) =>
          typeof pet.id === 'string' &&
          typeof pet.name === 'string' &&
          typeof pet.breed === 'string' &&
          speciesList.includes(pet.species) &&
          Number.isFinite(pet.ageMonths) &&
          pet.ageMonths >= 1 &&
          pet.ageMonths <= 480,
      )
    )
      return null;
    if (
      !data.events.every(
        (event: CareEvent) =>
          typeof event.id === 'string' &&
          typeof event.petId === 'string' &&
          typeof event.title === 'string' &&
          typeof event.note === 'string' &&
          ['meal', 'walk', 'sleep', 'play', 'reminder'].includes(event.kind) &&
          ['daily', 'once'].includes(event.repeat) &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time) &&
          Number.isFinite(event.duration) &&
          event.duration > 0,
      )
    )
      return null;
    // Extend sample collections while preserving every real profile and saved care moment.
    const additions = data.demoMode
      ? demoPets.filter((pet) => !data.pets.some((saved: Pet) => saved.id === pet.id))
      : [];
    return seedDemoHistory({
      ...data,
      pets: [...data.pets, ...additions],
      events: [...data.events, ...additions.flatMap(defaultEvents)],
      appearance: ['light', 'dark'].includes(data.appearance) ? data.appearance : 'system',
      activePetId: data.pets.some((pet: Pet) => pet.id === data.activePetId)
        ? data.activePetId
        : data.pets[0].id,
      completed: Array.isArray(data.completed)
        ? data.completed.filter((item: unknown) => typeof item === 'string')
        : [],
      trained: Array.isArray(data.trained)
        ? data.trained.filter((item: unknown) => typeof item === 'string')
        : [],
      history: Array.isArray(data.history)
        ? data.history.filter(
            (entry: HistoryEntry) =>
              entry &&
              typeof entry.id === 'string' &&
              typeof entry.petId === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
              ['practice', 'note'].includes(entry.kind) &&
              typeof entry.title === 'string' &&
              typeof entry.note === 'string' &&
              (entry.minutes === undefined ||
                (Number.isFinite(entry.minutes) && entry.minutes > 0)),
          )
        : [],
      demoSeedVersion: data.demoSeedVersion === 1 ? 1 : undefined,
      onboarded: !!data.onboarded,
      sound: !!data.sound,
      demoMode: !!data.demoMode,
    });
  } catch {
    return null;
  }
}
export function readData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseData(raw) : null;
  } catch {
    return null;
  }
}
export async function photoToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare this photo.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
