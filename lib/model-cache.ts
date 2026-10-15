import {
  MODEL_BASE,
  MODEL_LIBRARY,
  MODEL_LIBRARY_SHA,
  MODEL_MANIFEST_SHA,
  MODEL_RUNTIME_CACHE,
  MODEL_WEIGHT_BYTES,
  MODEL_CHAT_CONFIG_SHA,
  MODEL_TOKENIZER_SHA,
  sha256Base64,
} from './model-config';

export interface ModelCacheInfo {
  complete: boolean;
  bytes: number;
  files: number;
  runtimeReady: boolean;
}
export async function inspectModelCache(
  storage: CacheStorage,
  origin: string,
): Promise<ModelCacheInfo> {
  return checkModelCache(storage, origin, false);
}
async function checkModelCache(
  storage: CacheStorage,
  origin: string,
  repair: boolean,
): Promise<ModelCacheInfo> {
  const names = await storage.keys();
  const model = names.includes('webllm/model') ? await storage.open('webllm/model') : null;
  const config = names.includes('webllm/config') ? await storage.open('webllm/config') : null;
  const runtime = names.includes(MODEL_RUNTIME_CACHE)
    ? await storage.open(MODEL_RUNTIME_CACHE)
    : null;
  let complete = true,
    bytes = 0,
    files = 0;
  const invalid = async (cache: Cache | null, url: string) => {
    complete = false;
    if (repair) await cache?.delete(url);
  };
  const manifest = await model?.match(MODEL_BASE + 'tensor-cache.json');
  if (!manifest) complete = false;
  else {
    const buffer = await manifest.arrayBuffer();
    if (!manifest.ok || (await sha256Base64(buffer)) !== MODEL_MANIFEST_SHA)
      await invalid(model, MODEL_BASE + 'tensor-cache.json');
    else {
      const data = JSON.parse(new TextDecoder().decode(buffer));
      const records = data.records as { dataPath: string; nbytes: number }[];
      if (
        !Array.isArray(records) ||
        records.length !== 22 ||
        records.reduce((sum, item) => sum + item.nbytes, 0) !== MODEL_WEIGHT_BYTES
      )
        complete = false;
      else {
        bytes += buffer.byteLength;
        files++;
        for (const record of records) {
          if (!/^params_shard_\d+\.bin$/.test(record.dataPath)) {
            complete = false;
            continue;
          }
          const url = MODEL_BASE + record.dataPath;
          const response = await model?.match(url);
          if (!response?.ok) {
            await invalid(model, url);
            continue;
          }
          const length = response.headers.get('content-length');
          const size = length ? Number(length) : (await response.blob()).size;
          if (size !== record.nbytes) {
            await invalid(model, url);
            continue;
          }
          bytes += size;
          files++;
        }
      }
    }
  }
  for (const [cache, file, digest] of [
    [model, 'tokenizer.json', MODEL_TOKENIZER_SHA],
    [config, 'mlc-chat-config.json', MODEL_CHAT_CONFIG_SHA],
  ] as const) {
    const response = await cache?.match(MODEL_BASE + file);
    if (!response?.ok) await invalid(cache, MODEL_BASE + file);
    else {
      const buffer = await response.arrayBuffer();
      if ((await sha256Base64(buffer)) !== digest) await invalid(cache, MODEL_BASE + file);
      else {
        bytes += buffer.byteLength;
        files++;
      }
    }
  }
  const library = await runtime?.match(new URL(MODEL_LIBRARY, origin).href);
  let runtimeReady = false;
  if (library?.ok) {
    const buffer = await library.arrayBuffer();
    runtimeReady = (await sha256Base64(buffer)) === MODEL_LIBRARY_SHA;
    if (runtimeReady) {
      bytes += buffer.byteLength;
      files++;
    }
  }
  if (!runtimeReady) await invalid(runtime, new URL(MODEL_LIBRARY, origin).href);
  return { complete: complete && runtimeReady, bytes, files, runtimeReady };
}
// WebLLM trusts existing cache entries, including entries that failed verification.
// Repair those entries before reload so retry can keep the valid shards and fetch
// only missing or invalid files. A verified manifest is needed to check shard sizes.
export async function prepareModelCache(
  storage: CacheStorage,
  origin: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const model = await storage.open('webllm/model');
  await cacheVerifiedFile(
    model,
    MODEL_BASE + 'tensor-cache.json',
    MODEL_MANIFEST_SHA,
    signal,
    true,
  );
  await checkModelCache(storage, origin, true);
  signal.throwIfAborted();
}
async function cacheVerifiedFile(
  cache: Cache,
  url: string,
  digest: string,
  signal: AbortSignal,
  allowDownload: boolean,
) {
  signal.throwIfAborted();
  const cached = await cache.match(url);
  if (cached?.ok && (await sha256Base64(await cached.arrayBuffer())) === digest) return;
  if (!allowDownload)
    throw new Error('Some downloaded files are missing. Reconnect and download again.');
  await cache.delete(url);
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`The model download failed (HTTP ${response.status}).`);
  if ((await sha256Base64(await response.clone().arrayBuffer())) !== digest)
    throw new Error('The model file could not be verified. Try the download again.');
  signal.throwIfAborted();
  await cache.put(url, response);
}
export async function cacheModelRuntime(signal: AbortSignal, allowDownload: boolean) {
  const cache = await caches.open(MODEL_RUNTIME_CACHE);
  const url = new URL(MODEL_LIBRARY, location.origin).href;
  await cacheVerifiedFile(cache, url, MODEL_LIBRARY_SHA, signal, allowDownload);
}
