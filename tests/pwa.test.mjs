import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const origin = 'https://school.example';

async function worker({ failNetwork = false, networkResponse, initialCaches = {} } = {}) {
  const listeners = new Map();
  const stores = new Map(Object.entries(initialCaches).map(([name, entries]) => [name, new Map(entries)]));
  const network = [];
  let skipped = 0;
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(request, response) { entries.set(key(request), response.clone()); },
        async match(request) { return entries.get(key(request))?.clone(); },
        async keys() { return [...entries.keys()].map((url) => new Request(url)); },
        async delete(request) { return entries.delete(key(request)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const scope = {
    location: new URL(`${origin}/sw.js`),
    addEventListener(type, listener) { listeners.set(type, listener); },
    clients: { async claim() {} },
    async skipWaiting() { skipped++; },
  };
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  vm.runInNewContext(source, {
    self: scope, caches, URL, Request, Response,
    fetch: async (request) => {
      network.push(request);
      if (failNetwork) throw new TypeError('Network unavailable');
      return networkResponse ? networkResponse.clone() : new Response('public asset', { headers: { 'content-type': key(request).endsWith('.js') ? 'text/javascript' : 'text/html' } });
    },
  });
  async function dispatch(type, values = {}) {
    const pending = [];
    let response;
    const listener = listeners.get(type);
    assert.ok(listener, `worker implements ${type} behavior`);
    listener({ ...values, waitUntil(value) { pending.push(value); }, respondWith(value) { response = Promise.resolve(value); } });
    const result = response ? await response : undefined;
    await Promise.all(pending);
    return result;
  }
  return { dispatch, stores, network, get skipped() { return skipped; } };
}

function request(path, options = {}) {
  return { url: `${origin}${path}`, method: 'GET', mode: 'cors', headers: new Headers(), ...options };
}

test('API, authenticated images, writes and unknown resources never enter worker cache handling', async () => {
  const sw = await worker();
  for (const req of [
    request('/api/me'), request('/api/images/3'), request('/api/attempts', { method: 'POST', mode: 'navigate' }),
    request('/api/export', { mode: 'navigate' }), request('/uploads/student.png'),
    request('/assets/student.png'), request('/assets/app-AbCd1234.js?student=3'),
    request('/assets/app-AbCd1234.js', { headers: new Headers({ Authorization: 'Bearer private' }) }),
    request('/assets/app-AbCd1234.js', { url: 'https://cdn.example/assets/app-AbCd1234.js' }),
  ]) assert.equal(await sw.dispatch('fetch', { request: req }), undefined, req.url);
  assert.equal(sw.stores.size, 0);
  assert.equal(sw.network.length, 0);
});

test('offline navigation shows a public fallback without retaining HTML containing personal data', async () => {
  const initialCaches = { 'smartexam-public-v1': [[`${origin}/offline.html`, new Response('Reconnect to continue', { headers: { 'content-type': 'text/html' } })]] };
  const offline = await worker({ failNetwork: true, initialCaches });
  assert.equal(await (await offline.dispatch('fetch', { request: request('/', { mode: 'navigate' }) })).text(), 'Reconnect to continue');
  const online = await worker({ networkResponse: new Response('Student secret', { headers: { 'content-type': 'text/html' } }), initialCaches });
  assert.equal(await (await online.dispatch('fetch', { request: request('/', { mode: 'navigate' }) })).text(), 'Student secret');
  assert.equal([...online.stores.values()][0].size, 1);
});

test('build assets remain available offline and their cache has a finite size', async () => {
  const sw = await worker();
  for (let index = 0; index < 75; index++) {
    await sw.dispatch('fetch', { request: request(`/assets/chunk-${String(index).padStart(8, '0')}.js`) });
  }
  const entries = [...sw.stores.values()].flatMap((store) => [...store.entries()]);
  assert.ok(entries.length <= 64);
  assert.ok(entries.length > 0);
  const cached = await worker({ failNetwork: true, initialCaches: Object.fromEntries([...sw.stores].map(([name, store]) => [name, [...store]])) });
  assert.equal(await (await cached.dispatch('fetch', { request: request('/assets/chunk-00000074.js') })).text(), 'public asset');
});

test('private responses, errors and HTML masquerading as scripts never become cached assets', async () => {
  for (const response of [
    new Response('private', { headers: { 'content-type': 'text/javascript', 'cache-control': 'private, max-age=3600' } }),
    new Response('secret', { headers: { 'content-type': 'text/javascript', 'cache-control': 'no-store' } }),
    new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('failure', { status: 500, headers: { 'content-type': 'text/javascript' } }),
  ]) {
    const sw = await worker({ networkResponse: response });
    await sw.dispatch('fetch', { request: request('/assets/app-AbCd1234.js') });
    assert.equal([...sw.stores.values()].reduce((total, store) => total + store.size, 0), 0);
  }
});

test('activation removes only SmartExam public caches and updates wait for explicit consent', async () => {
  const sw = await worker({ initialCaches: { 'smartexam-public-old': [], 'another-app-cache': [], 'smartexam-public-v1': [] } });
  await sw.dispatch('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), ['another-app-cache', 'smartexam-public-v1']);
  assert.equal(sw.skipped, 0);
  await sw.dispatch('message', { data: { type: 'UNKNOWN' } });
  assert.equal(sw.skipped, 0);
  await sw.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(sw.skipped, 1);
});

test('installation preloads only public offline resources and does not replace an active worker', async () => {
  const sw = await worker();
  await sw.dispatch('install');
  const paths = sw.network.map((req) => new URL(req.url).pathname);
  assert.ok(paths.includes('/offline.html'));
  assert.ok(paths.every((path) => ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/manifest.webmanifest', '/favicon.svg'].includes(path)));
  assert.ok(sw.network.every((req) => req.credentials === 'omit'));
  assert.equal(sw.skipped, 0);
});

test('manifest has standalone launch and real correctly sized PNG icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const size of [192, 512]) {
    const entry = manifest.icons.find((icon) => icon.sizes === `${size}x${size}` && icon.type === 'image/png');
    assert.ok(entry, `${size}px icon advertised`);
    const png = await readFile(new URL(`../public${entry.src}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

async function client({ secure = true, online = true, waiting = false } = {}) {
  const events = new Map();
  const swEvents = new Map();
  let reloads = 0;
  let registrations = 0;
  const messages = [];
  const registration = {
    active: {}, installing: null,
    waiting: waiting ? { postMessage(message) { messages.push(message); } } : null,
    addEventListener() {},
  };
  const navigator = {
    onLine: online,
    serviceWorker: {
      controller: {},
      async register(url, options) {
        assert.equal(url, '/sw.js');
        assert.equal(options.updateViaCache, 'none');
        registrations++;
        return registration;
      },
      addEventListener(type, listener) { swEvents.set(type, listener); },
    },
  };
  const window = {
    isSecureContext: secure,
    addEventListener(type, listener) { events.set(type, listener); },
    matchMedia() { return { matches: false }; },
    location: { reload() { reloads++; } },
  };
  const source = await readFile(new URL('../src/pwa.ts', import.meta.url), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, navigator, window, console });
  assert.equal(typeof exports.registerPwa, 'function', 'PWA registration is available');
  return { api: exports, events, swEvents, messages, get reloads() { return reloads; }, get registrations() { return registrations; } };
}

test('PWA registration handles insecure LAN connections without throwing', async () => {
  const app = await client({ secure: false });
  await app.api.registerPwa();
  assert.equal(app.registrations, 0);
  assert.equal(app.api.getPwaSnapshot().supported, false);
});

test('a worker update never reloads a page until this page explicitly accepts it', async () => {
  const app = await client({ waiting: true });
  await app.api.registerPwa();
  await app.api.registerPwa();
  assert.equal(app.registrations, 1);
  assert.equal(app.api.getPwaSnapshot().updateReady, true);
  app.swEvents.get('controllerchange')();
  assert.equal(app.reloads, 0);
  assert.equal(app.api.activatePwaUpdate(), true);
  assert.equal(app.messages[0]?.type, 'ACTIVATE_UPDATE');
  app.swEvents.get('controllerchange')();
  assert.equal(app.reloads, 1);
});

test('installation and connection status survive mounting UI after browser events', async () => {
  const app = await client();
  await app.api.registerPwa();
  app.events.get('offline')();
  assert.equal(app.api.getPwaSnapshot().online, false);
  app.events.get('online')();
  assert.equal(app.api.getPwaSnapshot().online, true);
  let prompts = 0;
  let prevented = false;
  app.events.get('beforeinstallprompt')({
    preventDefault() { prevented = true; },
    async prompt() { prompts++; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  assert.equal(prevented, true);
  assert.equal(app.api.getPwaSnapshot().installable, true);
  assert.equal(await app.api.installPwa(), 'accepted');
  assert.equal(prompts, 1);
  assert.equal(await app.api.installPwa(), 'unavailable');
  app.events.get('appinstalled')();
  assert.equal(app.api.getPwaSnapshot().installed, true);
  assert.equal(app.api.getPwaSnapshot().installable, false);
});
