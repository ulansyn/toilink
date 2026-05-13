const SW_VERSION = 'toilink-app-v4';
const PAGE_CACHE = `${SW_VERSION}:pages`;
const ASSET_CACHE = `${SW_VERSION}:assets`;

const PRECACHE_PAGES = [
  '/',
  '/landing.html',
  '/login.html',
  '/templates.html',
  '/guests.html'
];

const PRECACHE_ASSETS = [
  '/css/tokens.css',
  '/css/base.css',
  '/css/app-shell.css',
  '/css/fonts.css',
  '/css/tailwind.css',
  '/fonts/inter-400.woff2',
  '/fonts/inter-500.woff2',
  '/fonts/inter-600.woff2',
  '/fonts/inter-700.woff2',
  '/fonts/cormorant-400.woff2',
  '/fonts/cormorant-500.woff2',
  '/fonts/cormorant-600.woff2',
  '/images/logo.webp',
  '/js/app-shell.js',
  '/js/initAuth.js',
  '/js/dashboard.js',
  '/js/guests.js',
  '/js/mobile-editor.js',
  '/js/wizard.js',
  '/js/wizard-bridge.js',
  '/js/event.js',
  '/templates/template-1/schema.json'
];

function normalizeSameOriginUrl(input) {
  const url = new URL(input, self.location.origin);
  if (url.origin !== self.location.origin) return null;
  if (url.searchParams.has('v') && url.searchParams.size === 1) {
    url.search = '';
  }
  return url;
}

async function precacheAll() {
  const pageCache = await caches.open(PAGE_CACHE);
  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.allSettled(PRECACHE_PAGES.map((path) => pageCache.add(path)));
  await Promise.allSettled(PRECACHE_ASSETS.map((path) => assetCache.add(path)));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await precacheAll();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('toilink-app-') && !name.startsWith(SW_VERSION))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'WARM_URLS' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const pageCache = await caches.open(PAGE_CACHE);
    await Promise.allSettled(data.urls.map(async (rawUrl) => {
      const url = normalizeSameOriginUrl(rawUrl);
      if (!url) return;
      const request = new Request(url.pathname, { credentials: 'same-origin' });
      const response = await fetch(request);
      if (response.ok) await pageCache.put(request, response.clone());
    }));
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const normalizedUrl = normalizeSameOriginUrl(request.url);
  if (!normalizedUrl) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      const cacheKey = new Request(normalizedUrl.pathname, { credentials: 'same-origin' });
      const cached = await cache.match(cacheKey);
      const networkPromise = fetch(request)
        .then(async (response) => {
          if (response.ok) await cache.put(cacheKey, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const network = await networkPromise;
      if (network) return network;
      return Response.error();
    })());
    return;
  }

  if (normalizedUrl.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cacheKey = new Request(normalizedUrl.pathname + normalizedUrl.search, { credentials: 'same-origin' });
    const fallbackKey = new Request(normalizedUrl.pathname, { credentials: 'same-origin' });
    const cached = await cache.match(cacheKey) || await cache.match(fallbackKey);

    const networkPromise = fetch(request)
      .then(async (response) => {
        if (response.ok) {
          await cache.put(cacheKey, response.clone());
          if (normalizedUrl.search) await cache.put(fallbackKey, response.clone());
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(networkPromise);
      return cached;
    }

    const network = await networkPromise;
    if (network) return network;
    return Response.error();
  })());
});
