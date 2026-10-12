'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowClockwiseIcon,
  ChatCircleDotsIcon,
  CheckIcon,
  DownloadSimpleIcon,
  LockSimpleIcon,
  PauseIcon,
  PowerIcon,
  SparkleIcon,
  StopCircleIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  TrashIcon,
  XIcon,
  CalendarPlusIcon,
  PawPrintIcon,
} from '@phosphor-icons/react';
import { Animal, IconButton, SourceLink, haptic, playTone } from './shared';
import { EventEditor } from './details';
import {
  ageLabel,
  lessonsFor,
  recurrenceLabel,
  type CareEvent,
  type Lesson,
  type Pet,
} from '@/lib/care';
import {
  assistantSuggestions,
  generationMessages,
  prepareReply,
  validateGeneratedReply,
  type AssistantMessage,
} from '@/lib/assistant';
import { exportConversation, readConversation, saveConversation } from '@/lib/assistant-storage';
import {
  cancelModelDownload,
  deleteLocalModel,
  downloadLocalModel,
  generateLocalAnswer,
  getModelState,
  getServerModelState,
  inspectLocalModel,
  isAbortError,
  stopLocalModel,
  subscribeModel,
} from '@/lib/local-model';
import { formatBytes, MODEL_BYTES } from '@/lib/model-config';
import type { AppData } from '@/lib/storage';

const preferenceKey = 'nuzzle-use-local-model';
function ModelControls({
  enabled,
  onEnabled,
}: {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
}) {
  const state = useSyncExternalStore(subscribeModel, getModelState, getServerModelState);
  const [remove, setRemove] = useState(false);
  const [working, setWorking] = useState(false);
  const reduced = useReducedMotion();
  const busy = state.phase === 'downloading' || state.phase === 'loading';
  const download = async () => {
    try {
      await downloadLocalModel();
      onEnabled(true);
      haptic(true);
    } catch {
      /* The download state contains a useful error and care notes remain available. */
    }
  };
  return (
    <div className="model-controls">
      <div className="model-card-heading">
        <span className="model-symbol">
          <SparkleIcon size={24} weight="fill" />
        </span>
        <div>
          <span className="eyebrow">BUILT WITH LLAMA</span>
          <h3>A companion on your device.</h3>
        </div>
        {state.complete && (
          <span className="model-ready-mark" aria-label="Downloaded">
            <CheckIcon size={22} />
          </span>
        )}
      </div>
      <p>
        Download Llama 3.2 to explain saved facts and lessons in your own words. Care notes, profile
        guidance, and reminders work without the download.
      </p>
      <div className="model-facts">
        <span>{formatBytes(MODEL_BYTES)} download</span>
        <span>About 1.2 GB working memory</span>
        <span>Runs on this device</span>
      </div>
      <p className="model-status" role="status">
        {busy
          ? state.message
          : !state.supported && state.phase !== 'checking'
            ? state.message
            : state.complete
              ? 'Downloaded files are available offline.'
              : state.phase === 'partial'
                ? 'A partial download is saved. Resume when you’re online.'
                : state.message}
      </p>
      {busy && (
        <div
          className="model-progress"
          role="progressbar"
          aria-label="Model preparation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.progress * 100)}
        >
          <motion.span
            initial={false}
            animate={{ width: `${Math.max(2, state.progress * 100)}%` }}
            transition={{ duration: reduced ? 0 : 0.3 }}
          />
        </div>
      )}
      {state.error && (
        <p className="assistant-notice" role="alert">
          {state.error}
        </p>
      )}
      <div className="model-actions">
        {busy ? (
          <IconButton
            label="Cancel model preparation"
            onClick={() => {
              void cancelModelDownload();
            }}
          >
            <PauseIcon size={24} weight="fill" />
          </IconButton>
        ) : (
          !state.complete &&
          state.supported && (
            <IconButton
              className="primary-icon"
              label={state.bytes ? 'Resume Llama download' : 'Download Llama'}
              onClick={() => {
                void download();
              }}
              disabled={working || state.phase === 'checking'}
            >
              <DownloadSimpleIcon size={24} />
            </IconButton>
          )
        )}
        {state.complete && state.supported && (
          <div className="model-use">
            <div>
              <strong>Use Llama for explanations</strong>
              <small>Food guidance and care totals stay tied to verified notes.</small>
            </div>
            <button
              type="button"
              className="icon-button"
              role="switch"
              aria-checked={enabled}
              aria-label="Use Llama for explanations"
              onClick={() => {
                onEnabled(!enabled);
                if (enabled) void stopLocalModel();
                haptic();
              }}
              disabled={busy || working}
            >
              {enabled ? <ToggleRightIcon size={32} weight="fill" /> : <ToggleLeftIcon size={32} />}
            </button>
          </div>
        )}
        {!busy && (
          <IconButton
            label="Check model files and device"
            onClick={() => {
              void inspectLocalModel();
            }}
            disabled={working}
          >
            <ArrowClockwiseIcon size={23} />
          </IconButton>
        )}
        {state.phase === 'ready' && (
          <IconButton
            label="Release model memory"
            onClick={() => {
              void stopLocalModel();
            }}
            disabled={working}
          >
            <PowerIcon size={23} />
          </IconButton>
        )}
        {!!state.bytes && !busy && (
          <IconButton
            label="Remove downloaded model"
            onClick={() => setRemove(true)}
            disabled={working}
          >
            <TrashIcon size={23} />
          </IconButton>
        )}
      </div>
      <AnimatePresence>
        {remove && (
          <motion.div
            className="model-remove-confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p>
              Remove the model download? Your pets, routines, and conversations stay on this device.
            </p>
            <IconButton
              label="Confirm model removal"
              disabled={working}
              onClick={() => {
                setWorking(true);
                void deleteLocalModel()
                  .then(() => {
                    onEnabled(false);
                    setRemove(false);
                  })
                  .catch(() => {})
                  .finally(() => setWorking(false));
              }}
            >
              <CheckIcon size={23} />
            </IconButton>
            <IconButton
              label="Keep the downloaded model"
              disabled={working}
              onClick={() => setRemove(false)}
            >
              <XIcon size={23} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
      {!!state.bytes && (
        <p className="model-storage">
          Model files: {formatBytes(state.bytes)}
          {state.storageQuota
            ? ` · Browser storage: ${formatBytes(state.storageUsed)} of ${formatBytes(state.storageQuota)}`
            : ''}
        </p>
      )}
      <p className="fine-print">
        {state.persistent
          ? 'Persistent storage is enabled.'
          : 'The browser may reclaim downloaded files when storage is low.'}{' '}
        Closing the app can pause a download. Finished files can be reused. A text model cannot
        identify a breed from a photo.
      </p>
      <div className="model-privacy">
        <LockSimpleIcon size={17} />
        <span>
          Pet data and conversations stay here. Downloading connects to the model host; answers
          don’t use a server.
        </span>
      </div>
      <a
        className="source-link"
        href="/runtime/llama-LICENSE.txt"
        target="_blank"
        rel="noopener noreferrer"
      >
        Llama Community License
      </a>
    </div>
  );
}

export default function OfflineAssistant({
  data,
  pet,
  initialPrompt = '',
  initialPanel = 'chat',
  onSaveReminder,
  onLesson,
}: {
  data: AppData;
  pet: Pet;
  initialPrompt?: string;
  initialPanel?: 'chat' | 'model';
  onSaveReminder: (event: CareEvent) => void;
  onLesson: (lesson: Lesson) => void;
}) {
  const state = useSyncExternalStore(subscribeModel, getModelState, getServerModelState);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const messagesRef = useRef<AssistantMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [tools, setTools] = useState(initialPanel === 'model');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [review, setReview] = useState<{ messageId: string; event: CareEvent } | null>(null);
  const [clearing, setClearing] = useState(false);
  const active = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const persistence = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(false);
  const autoSent = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const modelOn = enabled && state.complete && state.supported;
  useEffect(() => {
    active.current = true;
    try {
      setEnabled(localStorage.getItem(preferenceKey) === 'true');
    } catch {
      /* The preference remains temporary. */
    }
    void inspectLocalModel();
    void readConversation(pet.id)
      .then((saved) => {
        if (active.current) {
          messagesRef.current = saved;
          setMessages(saved);
        }
      })
      .catch(() => {
        if (active.current) setStorageError(true);
      })
      .finally(() => {
        if (active.current) setHydrated(true);
      });
    const focus = () => {
      void inspectLocalModel();
    };
    window.addEventListener('focus', focus);
    return () => {
      active.current = false;
      operation.current?.abort();
      window.removeEventListener('focus', focus);
    };
  }, [pet.id]);
  useEffect(() => {
    const container = transcript.current;
    const newest = container?.querySelector<HTMLElement>('.assistant-message:last-of-type');
    container?.scrollTo({
      top:
        newest &&
        newest.classList.contains('assistant') &&
        newest.offsetHeight > container.clientHeight
          ? newest.offsetTop - container.offsetTop
          : container.scrollHeight,
      behavior: reduced ? 'instant' : 'smooth',
    });
  }, [messages.length, busy, reduced]);
  const preference = (value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(preferenceKey, String(value));
    } catch {
      setNotice('Your model preference could not be saved on this device.');
    }
  };
  const commit = useCallback(
    (next: AssistantMessage[]) => {
      const kept = next.slice(-40);
      messagesRef.current = kept;
      setMessages(kept);
      persistence.current = persistence.current
        .catch(() => {})
        .then(() => saveConversation(pet.id, kept))
        .then(() => {
          if (active.current) setStorageError(false);
        })
        .catch(() => {
          if (active.current) setStorageError(true);
        });
    },
    [pet.id],
  );
  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || question.length > 800 || busyRef.current || !hydrated) return;
      busyRef.current = true;
      setBusy(true);
      setWriting(false);
      setInput('');
      setNotice('');
      haptic();
      const controller = new AbortController();
      operation.current = controller;
      const previous = messagesRef.current;
      const previousQuestion =
        [...previous].reverse().find((message) => message.role === 'user')?.text ?? '';
      const prepared = prepareReply(question, data, pet, new Date(), previousQuestion);
      const user: AssistantMessage = {
        id: crypto.randomUUID(),
        petId: pet.id,
        role: 'user',
        text: question,
        createdAt: new Date().toISOString(),
      };
      commit([...previous, user]);
      let reply = prepared.reply;
      try {
        if (modelOn && prepared.canGenerate) {
          try {
            const raw = await generateLocalAnswer(
              generationMessages(question, prepared, previous),
              controller.signal,
              () => {
                if (active.current) setWriting(true);
              },
            );
            const verified = validateGeneratedReply(raw, prepared);
            if (verified) reply = verified;
            else
              setNotice(
                'The model’s reply could not be verified against the notes. Showing the saved care notes instead.',
              );
          } catch (error) {
            if (isAbortError(error)) throw error;
            if (active.current)
              setNotice('The model could not answer this time. Here are the saved care notes.');
          }
        } else await new Promise<void>((resolve) => setTimeout(resolve, reduced ? 0 : 260));
        controller.signal.throwIfAborted();
        if (!active.current) return;
        commit([
          ...messagesRef.current,
          {
            ...reply,
            id: crypto.randomUUID(),
            petId: pet.id,
            role: 'assistant',
            createdAt: new Date().toISOString(),
          },
        ]);
        haptic(true);
        if (data.sound) playTone();
      } catch (error) {
        if (active.current)
          setNotice(
            isAbortError(error) ? 'Reply stopped.' : 'The reply could not be prepared. Try again.',
          );
      } finally {
        if (operation.current === controller) operation.current = null;
        busyRef.current = false;
        if (active.current) setBusy(false);
      }
    },
    [commit, data, hydrated, modelOn, pet, reduced],
  );
  useEffect(() => {
    if (hydrated && initialPrompt && state.phase !== 'checking' && !autoSent.current) {
      autoSent.current = true;
      void ask(initialPrompt);
    }
  }, [hydrated, initialPrompt, state.phase, ask]);
  if (review) {
    const owner = data.pets.find((item) => item.id === review.event.petId) ?? pet;
    return (
      <motion.div
        className="assistant-review"
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="assistant-review-heading">
          <IconButton label="Back to the conversation" onClick={() => setReview(null)}>
            <ArrowLeftIcon size={22} />
          </IconButton>
          <div>
            <span className="eyebrow">REVIEW BEFORE SAVING</span>
            <h3>A reminder for {owner.name}.</h3>
          </div>
        </div>
        <EventEditor
          key={review.event.id}
          pet={owner}
          event={review.event}
          onSave={(event) => {
            onSaveReminder(event);
            commit(
              messagesRef.current.map((message) =>
                message.id === review.messageId
                  ? { ...message, reminder: event, savedEventId: event.id }
                  : message,
              ),
            );
          }}
          onClose={() => setReview(null)}
        />
      </motion.div>
    );
  }
  return (
    <div className={`offline-assistant ${tools ? 'assistant-model-open' : ''}`}>
      <div className="assistant-context">
        <span className="assistant-avatar">
          <Animal species={pet.species} breed={pet.breed} photo={pet.photo} />
        </span>
        <div>
          <strong>{pet.name}’s little companion</strong>
          <small>
            {ageLabel(pet.ageMonths)} · {modelOn ? 'Llama on this device' : 'Saved care notes'}
          </small>
        </div>
        <IconButton
          label="Model downloads and privacy"
          onClick={() => {
            setTools(!tools);
            haptic();
          }}
        >
          <SparkleIcon size={22} weight={tools ? 'fill' : 'regular'} />
        </IconButton>
      </div>
      <AnimatePresence>
        {tools && (
          <motion.div
            className="assistant-model-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <ModelControls enabled={enabled} onEnabled={preference} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="assistant-conversation">
        <div className="assistant-toolbar">
          <span>
            <LockSimpleIcon size={15} /> A conversation kept on this device.
          </span>
          <div>
            <IconButton
              label="Download this conversation"
              onClick={() => exportConversation(pet.name, messages)}
              disabled={!messages.length}
            >
              <DownloadSimpleIcon size={20} />
            </IconButton>
            <IconButton
              label="Clear this conversation"
              onClick={() => setClearing(true)}
              disabled={!messages.length || busy}
            >
              <TrashIcon size={20} />
            </IconButton>
          </div>
        </div>
        <AnimatePresence>
          {clearing && (
            <motion.div
              className="assistant-clear"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p>Clear {pet.name}’s conversation? Pet records and the model download are kept.</p>
              <IconButton
                label="Confirm conversation clearing"
                onClick={() => {
                  commit([]);
                  setClearing(false);
                }}
              >
                <CheckIcon size={22} />
              </IconButton>
              <IconButton label="Keep this conversation" onClick={() => setClearing(false)}>
                <XIcon size={22} />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
        {storageError && (
          <p className="assistant-notice" role="alert">
            This conversation could not be saved. You can download a copy before closing.
          </p>
        )}
        <div
          className="assistant-transcript"
          ref={transcript}
          role="log"
          aria-label={`${pet.name}’s conversation`}
          aria-live="polite"
          aria-relevant="additions"
        >
          {!messages.length && (
            <div className="assistant-welcome">
              <ChatCircleDotsIcon size={38} />
              <h3>A little curious?</h3>
              <p>
                Ask about {pet.name}’s care, learn a lesson together, or look back at your recorded
                month.
              </p>
              <span>
                Care guidance uses the app’s sources. An assistant cannot diagnose an illness.
              </span>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.article
                key={message.id}
                className={`assistant-message ${message.role}`}
                initial={{ opacity: 0, y: 9, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 330, damping: 28 }}
              >
                <span className="assistant-message-label">
                  {message.role === 'user'
                    ? 'You'
                    : message.mode === 'llama'
                      ? 'Nuzzle · Built with Llama'
                      : 'Nuzzle · care notes'}
                </span>
                <p>{message.text}</p>
                {message.recordSummary && (
                  <details className="assistant-source">
                    <summary>Verified records</summary>
                    <p>{message.recordSummary}</p>
                  </details>
                )}
                {!!message.sources?.length && (
                  <details className="assistant-sources">
                    <summary>
                      {message.sources.some((source) => source.href)
                        ? 'Care sources and saved context'
                        : 'Saved context'}
                    </summary>
                    {message.sources.map((source) => (
                      <div className="assistant-source" key={source.id}>
                        <strong>{source.title}</strong>
                        <p>{source.text}</p>
                        {source.href && (
                          <SourceLink href={source.href}>Read the original source</SourceLink>
                        )}
                      </div>
                    ))}
                    {message.sources.some((source) => source.href) && (
                      <small>
                        These notes are available offline. Original websites need internet access.
                      </small>
                    )}
                  </details>
                )}
                {message.reminder && (
                  <div className="assistant-reminder">
                    <CalendarPlusIcon size={23} />
                    <div>
                      <strong>{message.reminder.title}</strong>
                      <small>
                        {message.reminder.time} · {recurrenceLabel(message.reminder)}
                      </small>
                      {message.assumptions?.map((assumption) => (
                        <small key={assumption}>{assumption}</small>
                      ))}
                      {message.savedEventId && (
                        <span className="assistant-saved">
                          <CheckIcon size={17} /> Saved to the schedule
                        </span>
                      )}
                    </div>
                    <IconButton
                      label={message.savedEventId ? 'Edit this reminder' : 'Review reminder draft'}
                      disabled={busy}
                      onClick={() => {
                        if (message.reminder)
                          setReview({ messageId: message.id, event: message.reminder });
                      }}
                    >
                      <CalendarPlusIcon size={23} />
                    </IconButton>
                  </div>
                )}
                {message.lessonId && (
                  <IconButton
                    label="Open this training lesson"
                    onClick={() => {
                      const lesson = lessonsFor(pet).find((item) => item.id === message.lessonId);
                      if (lesson) onLesson(lesson);
                    }}
                  >
                    <PawPrintIcon size={23} />
                  </IconButton>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="assistant-thinking" role="status">
              <span>
                {[0, 1, 2].map((index) => (
                  <motion.i
                    key={index}
                    animate={reduced ? {} : { y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: index * 0.12 }}
                  />
                ))}
              </span>
              <p>
                {modelOn
                  ? writing
                    ? 'Writing a local reply…'
                    : 'Thinking on this device…'
                  : 'Looking through the saved notes…'}
              </p>
            </div>
          )}
        </div>
        {notice && (
          <p className="assistant-notice" role="status">
            {notice}
          </p>
        )}
        <div className="assistant-suggestions" aria-label="Suggested questions">
          {assistantSuggestions(pet).map((question) => (
            <button
              type="button"
              key={question}
              onClick={() => {
                void ask(question);
              }}
              disabled={!hydrated || busy}
            >
              {question}
            </button>
          ))}
        </div>
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(input);
          }}
        >
          <label className="sr-only" htmlFor="assistant-question">
            Ask about {pet.name}
          </label>
          <textarea
            id="assistant-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={800}
            rows={2}
            placeholder={`Ask about ${pet.name}…`}
            disabled={!hydrated}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void ask(input);
              }
            }}
          />
          {busy ? (
            <IconButton label="Stop this reply" onClick={() => operation.current?.abort()}>
              <StopCircleIcon size={26} weight="fill" />
            </IconButton>
          ) : (
            <button
              type="submit"
              className="icon-button primary-icon"
              aria-label="Send question"
              title="Send question"
              disabled={!hydrated || !input.trim()}
            >
              <ArrowUpIcon size={24} />
            </button>
          )}
        </form>
        <p className="assistant-footnote">
          {modelOn
            ? 'Local model explanations can be imperfect. Check the linked care notes.'
            : 'No model download needed for saved care notes.'}
        </p>
      </div>
    </div>
  );
}
