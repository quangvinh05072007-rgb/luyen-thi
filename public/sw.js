// Cache public application resources only. Never store API responses, HTML
// navigations, uploads, answers, sessions, or student data in Cache Storage.
const CACHE_PREFIX = 'smartexam-public-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const MAX_ENTRIES = 64;
const PUBLIC_FILES = new Set([
  '/offline.html', '/manifest.webmanifest', '/favicon.svg',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
]);
const BUILD_RESOURCE = /^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf)$/;

function canStore(response, path) {
  if (!response.ok || response.status !== 200 || response.redirected || response.type === 'opaque') return false;
  if (/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control') || '')) return false;
  const type = response.headers.get('content-type') || '';
  if (path.endsWith('.js')) return /(?:javascript|ecmascript)/i.test(type);
  if (path.endsWith('.css')) return /text\/css/i.test(type);
  if (/\.(?:woff2?|ttf)$/.test(path)) return /(?:font\/|application\/(?:font|x-font|octet-stream))/i.test(type);
  return PUBLIC_FILES.has(path);
}

async function storePublic(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
  const keys = await cache.keys();
  // Keep the dedicated fallback even after many releases add new hashed assets.
  let excess = keys.length - MAX_ENTRIES;
  for (const key of keys) {
    if (excess <= 0) break;
    if (new URL(key.url).pathname !== '/offline.html') {
      await cache.delete(key);
      excess--;
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    for (const path of PUBLIC_FILES) {
      const request = new Request(new URL(path, self.location.origin), { credentials: 'omit', cache: 'reload' });
      const response = await fetch(request);
      if (!canStore(response, path)) throw new Error('Public offline resources unavailable');
      await storePublic(request, response);
    }
  })());
  // An existing exam must keep its current worker until the user accepts update.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname) || request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Never retain navigation HTML: it may contain authentication or user data.
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match('/offline.html') || new Response('Bạn đang ngoại tuyến. Hãy kết nối lại rồi tải lại trang.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (url.search || (!PUBLIC_FILES.has(url.pathname) && !BUILD_RESOURCE.test(url.pathname))) return;
  event.respondWith((async () => {
    try {
      // Network first also keeps public resources fresh without caching index.html.
      const response = await fetch(request);
      if (canStore(response, url.pathname)) {
        event.waitUntil(storePublic(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(request) || Response.error();
    }
  })());
});
