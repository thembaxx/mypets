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
  const names = await storage.keys();
  const model = names.includes('webllm/model') ? await storage.open('webllm/model') : null;
  const config = names.includes('webllm/config') ? await storage.open('webllm/config') : null;
  const runtime = names.includes(MODEL_RUNTIME_CACHE)
    ? await storage.open(MODEL_RUNTIME_CACHE)
    : null;
  let complete = true,
    bytes = 0,
    files = 0;
  const manifest = await model?.match(MODEL_BASE + 'tensor-cache.json');
  if (!manifest) complete = false;
  else {
    const buffer = await manifest.arrayBuffer();
    if ((await sha256Base64(buffer)) !== MODEL_MANIFEST_SHA) complete = false;
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
          const response = await model?.match(MODEL_BASE + record.dataPath);
          if (!response?.ok) {
            complete = false;
            continue;
          }
          const length = response.headers.get('content-length');
          const size = length ? Number(length) : (await response.blob()).size;
          if (size !== record.nbytes) {
            complete = false;
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
    if (!response?.ok) complete = false;
    else {
      const buffer = await response.arrayBuffer();
      if ((await sha256Base64(buffer)) !== digest) complete = false;
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
  return { complete: complete && runtimeReady, bytes, files, runtimeReady };
}
export async function cacheModelRuntime(signal: AbortSignal, allowDownload: boolean) {
  const cache = await caches.open(MODEL_RUNTIME_CACHE);
  const url = new URL(MODEL_LIBRARY, location.origin).href;
  const cached = await cache.match(url);
  if (cached?.ok && (await sha256Base64(await cached.clone().arrayBuffer())) === MODEL_LIBRARY_SHA)
    return;
  if (!allowDownload)
    throw new Error('Some downloaded files are missing. Reconnect and download again.');
  await cache.delete(url);
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (
    !response.ok ||
    (await sha256Base64(await response.clone().arrayBuffer())) !== MODEL_LIBRARY_SHA
  )
    throw new Error('The model file could not be verified. Try the download again.');
  signal.throwIfAborted();
  await cache.put(url, response);
}
