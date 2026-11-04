import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Nuzzle launches as standalone and retains an accessible fullscreen option', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.display_override, ['standalone', 'minimal-ui']);
  const app = read('components/pet-app.tsx');
  assert.ok(app.includes('document.documentElement.requestFullscreen()'));
  assert.ok(app.includes("fullscreenchange"));
  assert.ok(app.includes('Exit fullscreen'));
});

test('installed Nuzzle stays within device safe areas', () => {
  const css = read('app/native-shell.css');
  assert.ok(css.includes('safe-area-inset-top'));
  assert.ok(css.includes('safe-area-inset-bottom'));
  assert.ok(css.includes('100dvh'));
});
