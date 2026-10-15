import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inspectModelCache, prepareModelCache } from '../lib/model-cache';
import {
  MODEL_BASE,
  MODEL_LIBRARY,
  MODEL_MANIFEST_SHA,
  MODEL_RUNTIME_CACHE,
  sha256Base64,
} from '../lib/model-config';

const manifest = readFileSync(new URL('./fixtures/llama-tensor-cache.txt', import.meta.url));
const records = JSON.parse(manifest.toString()).records as { dataPath: string; nbytes: number }[];
const library = readFileSync(
  new URL('../public/runtime/llama-3.2-1b-q4f32-v0.2.86.wasm', import.meta.url),
);
const origin = 'https://nuzzle.example';
function storageStub(entries: Map<string, Map<string, Response>>): CacheStorage {
  // CacheStorage.match returns independent readable responses, even after repeated inspection.
  return {
    keys: async () => [...entries.keys()],
    open: async (name: string) => {
      if (!entries.has(name)) entries.set(name, new Map());
      return {
        match: async (url: string) => entries.get(name)?.get(url)?.clone(),
        delete: async (url: string) => entries.get(name)!.delete(url),
        put: async (url: string, response: Response) => {
          entries.get(name)!.set(url, response.clone());
        },
      };
    },
  } as unknown as CacheStorage;
}
function shardCache() {
  const model = new Map<string, Response>();
  model.set(MODEL_BASE + 'tensor-cache.json', new Response(new Uint8Array(manifest)));
  for (const record of records)
    model.set(
      MODEL_BASE + record.dataPath,
      new Response('', { headers: { 'content-length': String(record.nbytes) } }),
    );
  return model;
}

test('offline model inspection never fetches missing artifacts', async () => {
  const result = await inspectModelCache(storageStub(new Map()), origin);
  assert.deepEqual(result, { complete: false, bytes: 0, files: 0, runtimeReady: false });
});

test('all weight shards alone are not an offline-ready model', async () => {
  assert.equal(await sha256Base64(new Uint8Array(manifest).buffer), MODEL_MANIFEST_SHA);
  const entries = new Map([
    ['webllm/model', shardCache()],
    [
      MODEL_RUNTIME_CACHE,
      new Map([[origin + MODEL_LIBRARY, new Response(new Uint8Array(library))]]),
    ],
  ]);
  const result = await inspectModelCache(storageStub(entries), origin);
  assert.equal(result.runtimeReady, true);
  assert.equal(result.complete, false); // The tokenizer and chat config are also required.
  assert.equal(result.files, 24);
  entries.get('webllm/model')!.delete(MODEL_BASE + records[0].dataPath);
  const missing = await inspectModelCache(storageStub(entries), origin);
  assert.equal(missing.complete, false);
  assert.equal(missing.files, 23);
  assert.equal(result.bytes - missing.bytes, records[0].nbytes);
});

test('corrupt manifests, wrong-sized shards, and invalid runtime libraries cannot appear ready', async () => {
  const model = shardCache();
  model.set(
    MODEL_BASE + records[0].dataPath,
    new Response('truncated', { headers: { 'content-length': '9' } }),
  );
  const entries = new Map([
    ['webllm/model', model],
    [
      'webllm/config',
      new Map([[MODEL_BASE + 'mlc-chat-config.json', new Response('{"tampered":true}')]]),
    ],
    [MODEL_RUNTIME_CACHE, new Map([[origin + MODEL_LIBRARY, new Response('wrong library')]])],
  ]);
  const result = await inspectModelCache(storageStub(entries), origin);
  assert.equal(result.complete, false);
  assert.equal(result.runtimeReady, false);
  assert.equal(result.files, 22); // Only manifest + 21 intact shard entries count.
  model.set(MODEL_BASE + 'tensor-cache.json', new Response('{"records":[]}'));
  const corrupt = await inspectModelCache(storageStub(entries), origin);
  assert.equal(corrupt.complete, false);
  assert.equal(corrupt.files, 0);
});

test('retry removes invalid cached files while preserving valid shards and unrelated data', async (t) => {
  const model = shardCache();
  const shardUrl = MODEL_BASE + records[0].dataPath;
  model.set(shardUrl, new Response('truncated'));
  model.set(MODEL_BASE + 'tokenizer.json', new Response('damaged tokenizer'));
  const config = new Map([[MODEL_BASE + 'mlc-chat-config.json', new Response('damaged config')]]);
  const runtime = new Map([[origin + MODEL_LIBRARY, new Response('damaged runtime')]]);
  const shell = new Map([[origin + '/', new Response('offline app')]]);
  const entries = new Map([
    ['webllm/model', model],
    ['webllm/config', config],
    [MODEL_RUNTIME_CACHE, runtime],
    ['mypets-shell-test', shell],
  ]);
  const storage = storageStub(entries);
  t.mock.method(globalThis, 'fetch', () =>
    assert.fail('A valid manifest must not be downloaded again'),
  );

  await inspectModelCache(storage, origin);
  assert.ok(config.has(MODEL_BASE + 'mlc-chat-config.json')); // Inspection is read-only.
  await prepareModelCache(storage, origin, new AbortController().signal);

  assert.equal(config.size, 0);
  assert.equal(runtime.size, 0);
  assert.equal(model.has(shardUrl), false);
  assert.equal(model.has(MODEL_BASE + 'tokenizer.json'), false);
  assert.equal(model.size, records.length); // Manifest + 21 valid shards remain.
  assert.ok(model.has(MODEL_BASE + records[1].dataPath));
  assert.equal(await shell.get(origin + '/')!.text(), 'offline app');
});

test('retry replaces a corrupt manifest before checking cached shards', async (t) => {
  const model = shardCache();
  const url = MODEL_BASE + 'tensor-cache.json';
  model.set(url, new Response('damaged manifest'));
  model.set(MODEL_BASE + records[0].dataPath, new Response('truncated'));
  const entries = new Map([
    ['webllm/model', model],
    [
      MODEL_RUNTIME_CACHE,
      new Map([[origin + MODEL_LIBRARY, new Response(new Uint8Array(library))]]),
    ],
  ]);
  const controller = new AbortController();
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(input, url);
      assert.equal(init?.signal, controller.signal);
      assert.equal(init?.cache, 'no-cache');
      return new Response(new Uint8Array(manifest));
    },
  );

  await prepareModelCache(storageStub(entries), origin, controller.signal);

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(await sha256Base64(await model.get(url)!.clone().arrayBuffer()), MODEL_MANIFEST_SHA);
  assert.equal(model.has(MODEL_BASE + records[0].dataPath), false);
  assert.ok(model.has(MODEL_BASE + records[1].dataPath));
  assert.equal(entries.get(MODEL_RUNTIME_CACHE)!.size, 1);
});

test('retry never caches an invalid manifest or starts a cancelled download', async (t) => {
  const entries = new Map<string, Map<string, Response>>();
  const storage = storageStub(entries);
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('invalid download'),
  );
  await assert.rejects(
    prepareModelCache(storage, origin, new AbortController().signal),
    /could not be verified/,
  );
  assert.equal(entries.get('webllm/model')!.size, 0);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareModelCache(storage, origin, controller.signal), {
    name: 'AbortError',
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});
