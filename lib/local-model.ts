import type { WebWorkerMLCEngine, ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import {
  MODEL_BYTES,
  MODEL_CACHE_NAMES,
  MODEL_CONFIG,
  MODEL_ID,
  MODEL_RUNTIME_CACHE,
} from './model-config';
import { cacheModelRuntime, inspectModelCache, type ModelCacheInfo } from './model-cache';

export type ModelPhase =
  | 'checking'
  | 'available'
  | 'unsupported'
  | 'partial'
  | 'stored'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error';
export interface LocalModelState {
  phase: ModelPhase;
  supported: boolean;
  complete: boolean;
  bytes: number;
  progress: number;
  message: string;
  error: string;
  persistent: boolean;
  storageUsed: number;
  storageQuota: number;
  generating: boolean;
}
const initial: LocalModelState = {
  phase: 'checking',
  supported: false,
  complete: false,
  bytes: 0,
  progress: 0,
  message: 'Checking this device…',
  error: '',
  persistent: false,
  storageUsed: 0,
  storageQuota: 0,
  generating: false,
};
let state = initial;
const listeners = new Set<() => void>();
export const subscribeModel = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getModelState = () => state;
export const getServerModelState = () => initial;
function update(patch: Partial<LocalModelState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
let worker: Worker | null = null;
let engine: WebWorkerMLCEngine | null = null;
let loadController: AbortController | null = null;
let loadPromise: Promise<void> | null = null;
let inspectPromise: Promise<void> | null = null;
let generationController: AbortController | null = null;
let epoch = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function abortError() {
  return new DOMException('Stopped', 'AbortError');
}
export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? abortError());
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (/took too long|timeout/i.test(text))
    return 'The model took too long to answer. Saved care notes are available, or you can retry.';
  if (/quota|storage|disk/i.test(text))
    return 'There isn’t enough browser storage for this model. Free some space or remove the partial download.';
  if (/memory|allocation|buffer|device.?lost|gpu|adapter/i.test(text))
    return 'This device could not run the model. Close other apps and retry, or continue with saved care notes.';
  if (/offline|fetch|network|load.*file/i.test(text))
    return 'The download was interrupted or files are missing. Reconnect and resume; completed files are kept.';
  return 'The local model could not start. Retry or use saved care notes.';
}
async function deviceCapability(): Promise<{ supported: boolean; message: string }> {
  if (
    !globalThis.isSecureContext ||
    !('caches' in globalThis) ||
    !navigator.storage ||
    !navigator.gpu
  )
    return {
      supported: false,
      message: 'This browser cannot run the downloaded model. Saved care notes still work offline.',
    };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (
      adapter &&
      /swiftshader|llvmpipe/i.test(
        `${adapter.info?.architecture ?? ''} ${adapter.info?.description ?? ''}`,
      )
    )
      return {
        supported: false,
        message:
          'Llama needs a hardware graphics processor. This browser is using software graphics; saved care notes still work offline.',
      };
    if (
      !adapter ||
      adapter.limits.maxBufferSize < 256 * 1024 * 1024 ||
      adapter.limits.maxStorageBufferBindingSize < 128 * 1024 * 1024 ||
      adapter.limits.maxComputeWorkgroupStorageSize < 32768 ||
      adapter.limits.maxStorageBuffersPerShaderStage < 10
    )
      return {
        supported: false,
        message:
          'The graphics capability needed by Llama is unavailable. Saved care notes still work offline.',
      };
    return { supported: true, message: 'This device can try the local model.' };
  } catch {
    return {
      supported: false,
      message:
        'The browser could not access its graphics processor. Saved care notes still work offline.',
    };
  }
}
async function cacheInfo(): Promise<ModelCacheInfo> {
  if (!('caches' in globalThis))
    return { complete: false, bytes: 0, files: 0, runtimeReady: false };
  const info = await inspectModelCache(caches, location.origin);
  // A cached model also needs the actual worker and application code to survive an offline reload.
  const assets = await caches.match(
    new URL('/runtime/assistant-assets.json', location.origin).href,
  );
  const scripts: unknown = assets?.ok ? (await assets.json()).scripts : null;
  const scriptsReady =
    Array.isArray(scripts) &&
    scripts.length > 0 &&
    (
      await Promise.all(
        scripts.map((url: unknown) =>
          typeof url === 'string' && url.startsWith('/_next/static/') && url.endsWith('.js')
            ? caches.match(new URL(url, location.origin).href)
            : undefined,
        ),
      )
    ).every(Boolean);
  return {
    ...info,
    complete: info.complete && scriptsReady && !!(await caches.match(location.origin + '/')),
  };
}
export async function inspectLocalModel(): Promise<void> {
  if (loadPromise || state.generating) return;
  if (inspectPromise) return inspectPromise;
  inspectPromise = (async () => {
    try {
      const [capability, info, estimate, persistent] = await Promise.all([
        deviceCapability(),
        cacheInfo(),
        navigator.storage?.estimate().catch((): StorageEstimate => ({})) ?? ({} as StorageEstimate),
        navigator.storage?.persisted?.().catch(() => false) ?? false,
      ]);
      const phase: ModelPhase =
        engine && state.phase === 'ready'
          ? 'ready'
          : !capability.supported
            ? 'unsupported'
            : info.complete
              ? 'stored'
              : info.bytes
                ? 'partial'
                : 'available';
      update({
        phase,
        supported: capability.supported,
        complete: info.complete,
        bytes: info.bytes,
        message: capability.message,
        storageUsed: estimate.usage ?? 0,
        storageQuota: estimate.quota ?? 0,
        persistent,
        error: '',
      });
    } catch (error) {
      update({
        phase: 'error',
        message: 'Saved care notes are still available.',
        error: errorMessage(error),
      });
    }
  })().finally(() => {
    inspectPromise = null;
  });
  return inspectPromise;
}
function dispose() {
  clearTimeout(idleTimer);
  const oldEngine = engine;
  const oldWorker = worker;
  engine = null;
  worker = null;
  if (oldEngine) void oldEngine.unload().catch(() => {});
  // The worker owns GPU allocations. Termination also closes outstanding model fetches.
  oldWorker?.terminate();
}
function idleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!loadPromise && !state.generating) {
      dispose();
      update({ phase: state.complete ? 'stored' : 'available' });
    }
  }, 90000);
}
async function waitForAppCache(signal: AbortSignal) {
  if (!('serviceWorker' in navigator)) throw new Error('Offline storage is unavailable.');
  let readyTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await abortable(
      Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          readyTimeout = setTimeout(
            () => reject(new Error('The offline app is not ready. Reload and try again.')),
            15000,
          );
        }),
      ]),
      signal,
    );
  } finally {
    clearTimeout(readyTimeout);
  }
  if (navigator.serviceWorker.controller) return;
  await abortable(
    new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', done);
        resolve();
      };
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', done);
        reject(new Error('The offline app is not ready. Reload and try again.'));
      }, 15000);
      navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
    }),
    signal,
  );
}
async function loadModel(allowDownload: boolean): Promise<void> {
  if (engine && state.phase === 'ready') return;
  if (loadPromise) return loadPromise;
  clearTimeout(idleTimer);
  const run = ++epoch;
  const controller = new AbortController();
  loadController = controller;
  const signal = controller.signal;
  update({
    phase: allowDownload ? 'downloading' : 'loading',
    progress: 0,
    error: '',
    message: allowDownload ? 'Preparing your download…' : 'Opening the model on this device…',
  });
  const operation = (async () => {
    try {
      const capability = await deviceCapability();
      signal.throwIfAborted();
      if (!capability.supported) {
        update({ supported: false, phase: 'unsupported', message: capability.message });
        throw new Error('GPU adapter is unavailable.');
      }
      if (allowDownload) {
        if (!navigator.onLine) throw new Error('Reconnect to download the model.');
        const [estimate, info] = await Promise.all([navigator.storage.estimate(), cacheInfo()]);
        const needed = Math.max(0, MODEL_BYTES - info.bytes) + 128 * 1024 * 1024;
        if (estimate.quota && estimate.quota - (estimate.usage ?? 0) < needed)
          throw new Error('Storage quota is too small.');
        const persistent = (await navigator.storage.persist?.().catch(() => false)) ?? false;
        update({ persistent });
      } else if (!(await cacheInfo()).complete) throw new Error('Offline model files are missing.');
      await waitForAppCache(signal);
      await cacheModelRuntime(signal, allowDownload);
      const { WebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
      signal.throwIfAborted();
      worker = new Worker(new URL('./llm-worker.ts', import.meta.url), { type: 'module' });
      worker.onerror = () => {
        if (run === epoch) controller.abort(new Error('The model worker could not run.'));
      };
      const current = new WebWorkerMLCEngine(worker, {
        appConfig: MODEL_CONFIG,
        logLevel: 'WARN',
        initProgressCallback: (report) => {
          if (run !== epoch || signal.aborted) return;
          const progress = Math.max(0, Math.min(0.97, report.progress));
          update({
            progress,
            message:
              !allowDownload || report.progress > 0.9
                ? 'Preparing the model for this device…'
                : 'Saving model files to this device…',
          });
        },
      });
      engine = current;
      await abortable(current.reload(MODEL_ID, { context_window_size: 4096 }), signal);
      signal.throwIfAborted();
      const info = await cacheInfo();
      signal.throwIfAborted();
      if (!info.complete) throw new Error('Offline model files are missing.');
      update({
        phase: 'ready',
        supported: true,
        complete: true,
        bytes: info.bytes,
        progress: 1,
        message: 'Llama is ready on this device.',
        error: '',
      });
      idleRelease();
    } catch (error) {
      if (run === epoch) {
        dispose();
        let info: ModelCacheInfo = { complete: false, bytes: 0, files: 0, runtimeReady: false };
        try {
          info = await cacheInfo();
        } catch {
          /* The storage error is already surfaced. */
        }
        update({
          phase: isAbortError(error)
            ? info.complete
              ? 'stored'
              : info.bytes
                ? 'partial'
                : 'available'
            : 'error',
          complete: info.complete,
          bytes: info.bytes,
          message: 'Saved care notes are still available.',
          error: isAbortError(error) ? '' : errorMessage(error),
        });
      }
      throw error;
    } finally {
      if (run === epoch) {
        loadController = null;
        loadPromise = null;
      }
    }
  })();
  loadPromise = operation;
  return operation;
}
export const downloadLocalModel = () => loadModel(true);
export async function cancelModelDownload() {
  const pending = loadPromise;
  loadController?.abort(abortError());
  dispose();
  try {
    await pending;
  } catch {
    /* Cancellation is intentional; finished files remain cached. */
  }
}
export async function stopLocalModel() {
  generationController?.abort(abortError());
  engine?.interruptGenerate();
  await cancelModelDownload();
  dispose();
  update({
    generating: false,
    phase: state.complete
      ? 'stored'
      : state.bytes
        ? 'partial'
        : state.supported
          ? 'available'
          : 'unsupported',
  });
}
export async function deleteLocalModel() {
  await stopLocalModel();
  try {
    await Promise.all(
      [...MODEL_CACHE_NAMES, MODEL_RUNTIME_CACHE].map((name) => caches.delete(name)),
    );
    update({
      complete: false,
      bytes: 0,
      progress: 0,
      phase: state.supported ? 'available' : 'unsupported',
      error: '',
      message: 'The model files are removed. Your pet data and conversations are kept.',
    });
    await inspectLocalModel();
  } catch (error) {
    update({ phase: 'error', error: errorMessage(error) });
    throw error;
  }
}
export async function generateLocalAnswer(
  messages: ChatCompletionMessageParam[],
  signal: AbortSignal,
  onProgress?: (characters: number) => void,
): Promise<string> {
  if (state.generating) throw new Error('The model is already answering.');
  const stopLoading = () => {
    if (state.phase === 'loading') {
      loadController?.abort(abortError());
      dispose();
    }
  };
  signal.addEventListener('abort', stopLoading, { once: true });
  try {
    await abortable(loadModel(false), signal);
  } finally {
    signal.removeEventListener('abort', stopLoading);
  }
  signal.throwIfAborted();
  const current = engine;
  if (!current) throw new Error('The local model is unavailable.');
  clearTimeout(idleTimer);
  const controller = new AbortController();
  generationController = controller;
  const interrupt = () => {
    controller.abort(signal.reason ?? abortError());
    current.interruptGenerate();
  };
  signal.addEventListener('abort', interrupt, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException(
        'The model took too long. Use saved care notes or try again.',
        'TimeoutError',
      ),
    );
    current.interruptGenerate();
  }, 120000);
  update({ generating: true });
  try {
    const stream = await abortable(
      current.chat.completions.create({
        model: MODEL_ID,
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 360,
      }),
      controller.signal,
    );
    let raw = '';
    const iterator = stream[Symbol.asyncIterator]();
    while (true) {
      const chunk = await abortable(iterator.next(), controller.signal);
      if (chunk.done) break;
      raw += chunk.value.choices[0]?.delta.content ?? '';
      onProgress?.(raw.length);
    }
    controller.signal.throwIfAborted();
    return raw;
  } catch (error) {
    // Stop the worker as well as the visible reply; it owns the GPU allocations.
    if (controller.signal.aborted && engine === current) {
      dispose();
      update({ phase: state.complete ? 'stored' : 'available' });
    }
    if (!isAbortError(error)) {
      update({ error: errorMessage(error) });
      dispose();
      update({ phase: state.complete ? 'stored' : 'error' });
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', interrupt);
    clearTimeout(timeout);
    if (generationController === controller) {
      generationController = null;
      update({ generating: false });
      idleRelease();
    }
  }
}
