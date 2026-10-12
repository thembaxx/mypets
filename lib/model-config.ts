import type { AppConfig } from '@mlc-ai/web-llm';

export const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
export const MODEL_BASE =
  'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/a949835e0f9a65335bd834db02a44cf8fae34020/';
export const MODEL_LIBRARY = '/runtime/llama-3.2-1b-q4f32-v0.2.86.wasm';
export const MODEL_BYTES = 710385815;
export const MODEL_WEIGHT_BYTES = 695242752;
export const MODEL_CACHE_NAMES = ['webllm/model', 'webllm/config', 'webllm/wasm'] as const;
export const MODEL_RUNTIME_CACHE = 'nuzzle-assistant-runtime-v1';
export const MODEL_LIBRARY_SHA = 'yp4vs5EylPqikLG2BbVafjVwm5lRi5j1yhTXb6nW0sE=';
export const MODEL_MANIFEST_SHA = 'Jnlc75ZiP0e2n7jBqq8KiqfJOBpEbzXi3myhBCcfRNs=';
export const MODEL_CHAT_CONFIG_SHA = 'BGVh5aSNDJJrH8pWNyDFNIe1kUn+lYoYmo7mwI4O7zQ=';
export const MODEL_TOKENIZER_SHA = 'eePlImNfMXEwCRO7QhRkqH3mIiGCoFcLmyzLoqlksrQ=';
export const MODEL_CONFIG: AppConfig = {
  cacheBackend: 'cache',
  model_list: [
    {
      model_id: MODEL_ID,
      model: MODEL_BASE,
      model_lib: MODEL_LIBRARY,
      overrides: { context_window_size: 4096 },
      low_resource_required: true,
      vram_required_MB: 1128.82,
      integrity: {
        config: `sha256-${MODEL_CHAT_CONFIG_SHA}`,
        model_lib: `sha256-${MODEL_LIBRARY_SHA}`,
        tokenizer: { 'tokenizer.json': `sha256-${MODEL_TOKENIZER_SHA}` },
        onFailure: 'error',
      },
    },
  ],
};
export function formatBytes(bytes: number) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}
export async function sha256Base64(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return btoa(String.fromCharCode(...digest));
}
