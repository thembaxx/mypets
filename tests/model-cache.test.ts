import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inspectModelCache } from '../lib/model-cache';
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
    open: async (name: string) => ({
      match: async (url: string) => entries.get(name)?.get(url)?.clone(),
    }),
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
