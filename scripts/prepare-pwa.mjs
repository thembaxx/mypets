import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('out');
function collect(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? collect(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    );
}
// Recognition uses the CPU-only runtime from the exact locked ONNX release.
// Copy it after export; it is cached on demand rather than delaying the offline shell.
const runtimeRoot = path.join(root, 'runtime');
fs.mkdirSync(runtimeRoot, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  fs.copyFileSync(
    path.join('node_modules/onnxruntime-web/dist', file),
    path.join(runtimeRoot, file.replace(/\.mjs$/, '.js')),
  );
}
fs.copyFileSync('third-party/onnxruntime-LICENSE.txt', path.join(runtimeRoot, 'LICENSE.txt'));
fs.copyFileSync('third-party/llama-3.2-LICENSE.txt', path.join(runtimeRoot, 'llama-LICENSE.txt'));
fs.copyFileSync('third-party/llama-3.2-NOTICE.txt', path.join(runtimeRoot, 'llama-NOTICE.txt'));
fs.copyFileSync('third-party/webllm-LICENSE.txt', path.join(runtimeRoot, 'webllm-LICENSE.txt'));
// Turbopack emits optional backend assets even when wasmPaths overrides them.
// Those copies are unused by this CPU feature and exceed some static-host limits.
for (const file of collect(path.join(root, '_next/static'))) {
  if (/^ort-wasm-.*\.wasm$/.test(path.basename(file))) fs.unlinkSync(file);
}
for (const file of collect(root)) {
  if (fs.statSync(file).size > 25 * 1024 * 1024)
    throw new Error(`Static asset exceeds the 25 MiB hosting limit: ${path.relative(root, file)}`);
}
const assets = collect(path.join(root, '_next/static'))
  .filter((file) => /\.(js|css|woff2?)$/.test(file))
  .map((file) => '/' + path.relative(root, file).split(path.sep).join('/'));
// Model weights and the WASM library are optional downloads. Only the worker,
// client scripts, and small runtime manifest belong in the core offline shell.
fs.writeFileSync(
  path.join(runtimeRoot, 'assistant-assets.json'),
  JSON.stringify({ scripts: assets.filter((url) => url.endsWith('.js')) }),
);
const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(root, 'index.html')))
  .update(fs.readFileSync(path.join(root, 'brand/launch.mp4')))
  .update(fs.readFileSync(path.join(root, 'brand/launch.webp')))
  .digest('hex')
  .slice(0, 12);
const shell = [
  '/',
  '/manifest.webmanifest',
  '/manifest-dark.webmanifest',
  '/icons/maskable-512.png',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/brand/directions.webp',
  '/brand/launch.webp',
  '/brand/launch.mp4',
  '/runtime/assistant-assets.json',
  '/runtime/llama-LICENSE.txt',
  '/runtime/llama-NOTICE.txt',
  '/runtime/webllm-LICENSE.txt',
  ...collect(path.join(root, 'animals')).map(
    (file) => '/' + path.relative(root, file).split(path.sep).join('/'),
  ),
  ...assets,
];
const worker = fs
  .readFileSync('public/sw.js', 'utf8')
  .replace("const CACHE = 'mypets-shell-v1';", `const CACHE = 'mypets-shell-${hash}';`)
  .replace(/const SHELL = \[[\s\S]*?\];/, `const SHELL = ${JSON.stringify(shell)};`);
if (!worker.includes(hash)) throw new Error('Could not version the service worker.');
fs.writeFileSync(path.join(root, 'sw.js'), worker);
console.log(`PWA shell ${hash}: ${shell.length} local assets ready for offline use.`);
