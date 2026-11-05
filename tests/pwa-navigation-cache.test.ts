import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script } from 'node:vm';

test('offline navigation keeps home and visited 3D lab cached independently', async () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map<string, (event: unknown) => void>();
  const saved = new Map<string, Response>();
  let offline = false;

  const fakeCache = {
    put: async (key: string, response: Response) => {
      saved.set(key, response.clone());
    },
  };
  const caches = {
    open: async () => fakeCache,
    match: async (key: string) => saved.get(key)?.clone(),
  };
  const origin = 'https://mypets.example';
  const self = {
    location: { origin },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers.set(type, handler);
    },
  };
  const fetch = async (request: { url: string }): Promise<Response> => {
    if (offline) throw new Error('Offline');
    const pathname = new URL(request.url).pathname;
    return new Response(pathname === '/' ? '<main>Home</main>' : '<main>3D Lab</main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };
  new Script(source).runInNewContext({ self, caches, fetch, URL, Response });

  async function navigate(path: string): Promise<Response> {
    let handled: Promise<Response> | null = null;
    const listener = handlers.get('fetch');
    assert.ok(listener, 'Service worker must handle navigation');
    listener({
      request: { method: 'GET', url: origin + path, mode: 'navigate' },
      respondWith: (response: Promise<Response>) => {
        handled = response;
      },
    });
    assert.ok(handled, 'Service worker must respond');
    return handled;
  }

  assert.match(await (await navigate('/')).text(), /Home/);
  assert.match(await (await navigate('/3d-lab/')).text(), /3D Lab/);
  const home = await caches.match('/');
  const lab = await caches.match('/3d-lab/');
  assert.ok(home, 'Cached home page must exist after visiting the lab');
  assert.ok(lab, 'Cached lab page must exist after visiting the lab');
  assert.match(await home.text(), /Home/);
  assert.match(await lab.text(), /3D Lab/);

  offline = true;
  assert.match(await (await navigate('/')).text(), /Home/);
  assert.match(await (await navigate('/3d-lab/')).text(), /3D Lab/);
  // Unvisited routes still fall back to the real home screen, never the lab.
  assert.match(await (await navigate('/unvisited/')).text(), /Home/);
});

test('a downloaded replacement still loads when optional offline storage is full', async () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  let listener: ((event: unknown) => void) | undefined;
  let attempted = false;
  const origin = 'https://mypets.example';
  new Script(source).runInNewContext({
    self: {
      location: { origin },
      addEventListener: (name: string, callback: (event: unknown) => void) => {
        if (name === 'fetch') listener = callback;
      },
    },
    caches: {
      match: async () => undefined,
      open: async () => ({
        put: async () => {
          attempted = true;
          throw new Error('QuotaExceededError');
        },
      }),
    },
    fetch: async () => new Response('genuine downloaded model bytes', { status: 200 }),
    URL,
    Response,
  });
  let response: Promise<Response> | undefined;
  listener!({
    request: { method: 'GET', url: origin + '/models/replacements/dog.glb', mode: 'cors' },
    respondWith: (result: Promise<Response>) => {
      response = result;
    },
  });
  assert.equal(await (await response!).text(), 'genuine downloaded model bytes');
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(attempted, 'Offline model caching must have been attempted');
});
