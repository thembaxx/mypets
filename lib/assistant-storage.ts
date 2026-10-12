import type { AssistantMessage, AssistantSource } from './assistant';
import { validDateKey, type CareEvent } from './care';

const DB_NAME = 'nuzzle-conversations-v1';
const STORE = 'conversations';
const MAX_MESSAGES = 40;
const careHosts = new Set([
  'www.pdsa.org.uk',
  'www.akc.org',
  'www.rspca.org.uk',
  'www.msdvetmanual.com',
]);
function safeSource(source: unknown): source is AssistantSource {
  if (!source || typeof source !== 'object') return false;
  const value = source as AssistantSource;
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.text !== 'string'
  )
    return false;
  if (!value.href) return true;
  try {
    const url = new URL(value.href);
    return url.protocol === 'https:' && careHosts.has(url.hostname);
  } catch {
    return false;
  }
}
function safeReminder(value: CareEvent): boolean {
  return (
    !!value &&
    typeof value.id === 'string' &&
    typeof value.petId === 'string' &&
    typeof value.title === 'string' &&
    value.title.length <= 80 &&
    typeof value.note === 'string' &&
    typeof value.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) &&
    Number.isFinite(value.duration) &&
    value.duration >= 1 &&
    value.duration <= 1440 &&
    ['meal', 'walk', 'sleep', 'play', 'reminder'].includes(value.kind) &&
    ['daily', 'weekly', 'once'].includes(value.repeat) &&
    (value.repeat !== 'once' || (typeof value.date === 'string' && validDateKey(value.date))) &&
    (value.repeat !== 'weekly' ||
      (Array.isArray(value.weekdays) &&
        value.weekdays.length > 0 &&
        value.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
  );
}
export function parseConversation(value: unknown, petId: string): AssistantMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is AssistantMessage =>
        !!item &&
        typeof item.id === 'string' &&
        item.petId === petId &&
        ['user', 'assistant'].includes(item.role) &&
        typeof item.text === 'string' &&
        item.text.length <= 12000 &&
        typeof item.createdAt === 'string' &&
        (!item.reminder || safeReminder(item.reminder)) &&
        (!item.assumptions ||
          (Array.isArray(item.assumptions) &&
            item.assumptions.every((value: unknown) => typeof value === 'string'))) &&
        (!item.recordSummary ||
          (typeof item.recordSummary === 'string' && item.recordSummary.length <= 12000)) &&
        (!item.sources || (Array.isArray(item.sources) && item.sources.every(safeSource))),
    )
    .slice(-MAX_MESSAGES);
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'petId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Conversation storage is unavailable.'));
    request.onblocked = () =>
      reject(new Error('Close another Nuzzle tab to update conversation storage.'));
  });
}
export async function readConversation(petId: string): Promise<AssistantMessage[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(petId);
      request.onsuccess = () => resolve(parseConversation(request.result?.messages, petId));
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function saveConversation(petId: string, messages: AssistantMessage[]): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put({
        petId,
        messages: parseConversation(messages, petId),
        updatedAt: new Date().toISOString(),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Conversation could not be saved.'));
    });
  } finally {
    db.close();
  }
}
export function exportConversation(petName: string, messages: AssistantMessage[]) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ pet: petName, messages }, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${petName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-conversation.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
