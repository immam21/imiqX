// ============================================================
//  imiqX Service Worker — v3 (multi-tenant, fast cache)
// ============================================================
const CACHE_NAME = 'imiqx-v3';
const OFFLINE_URL = '/offline.html';
// Stale-while-revalidate freshness windows
const API_SWR_MS  = 30000;   // 30 s — products, settings, banners
const PAGE_SWR_MS = 10000;   // 10 s — page HTML
const DAY_MS      = 86400000; // 1 day — images, fonts, asset proxy

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('imiqx-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Hashed static chunks — safe to cache forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheForever(request)); return;
  }
  // Next image optimisation + our asset proxy — cache 1 day
  if (url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/api/asset')) {
    event.respondWith(cacheFirst(request, DAY_MS)); return;
  }
  // Slow-changing data APIs — serve cached instantly, revalidate behind the scenes
  const swrApis = ['/api/products', '/api/settings', '/api/banners', '/api/reviews', '/api/coupons', '/api/pwa-manifest'];
  if (swrApis.some((p) => url.pathname.endsWith(p))) {
    event.respondWith(staleWhileRevalidate(request, API_SWR_MS)); return;
  }
  // Mutation APIs — never cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkOnly(request)); return;
  }
  // Images / fonts — cache 1 day
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, DAY_MS)); return;
  }
  // Page navigations — SWR so repeat visits are instant
  if (request.mode === 'navigate') {
    event.respondWith(navigateSWR(request)); return;
  }
  event.respondWith(staleWhileRevalidate(request, API_SWR_MS));
});

// ─── Helpers ────────────────────────────────────────────────
function isFresh(response, maxMs) {
  if (!response) return false;
  const ts = response.headers.get('x-sw-cached-at');
  return ts ? (Date.now() - Number(ts) < maxMs) : false;
}
async function stamped(response) {
  const h = new Headers(response.headers);
  h.set('x-sw-cached-at', String(Date.now()));
  return new Response(await response.clone().arrayBuffer(), { status: response.status, statusText: response.statusText, headers: h });
}
async function staleWhileRevalidate(request, maxMs) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const net = fetch(request, { cache: 'no-store' })
    .then(async (r) => { if (r.ok) cache.put(request, await stamped(r)); return r; })
    .catch(() => null);
  if (cached) { if (!isFresh(cached, maxMs)) net; return cached; }
  return (await net) ?? new Response(JSON.stringify({ error: 'offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}
async function navigateSWR(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const net = fetch(request)
    .then(async (r) => { if (r.ok) cache.put(request, await stamped(r)); return r; })
    .catch(() => null);
  if (cached) { if (!isFresh(cached, PAGE_SWR_MS)) net; return cached; }
  return (await net) ?? (await caches.match(OFFLINE_URL)) ?? new Response('Offline', { status: 503 });
}
async function cacheFirst(request, maxMs) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached && isFresh(cached, maxMs)) return cached;
  try {
    const r = await fetch(request, { cache: 'no-store' });
    if (r.ok) cache.put(request, await stamped(r));
    return r;
  } catch { return cached ?? new Response('', { status: 408 }); }
}
async function cacheForever(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try { const r = await fetch(request); if (r.ok) cache.put(request, r.clone()); return r; }
  catch { return new Response('', { status: 408 }); }
}
async function networkOnly(request) {
  try { return await fetch(request); }
  catch { return new Response(JSON.stringify({ error: 'offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
}

// ─── Skip-waiting message ───────────────────────────────────
// Sent by PWAProvider when the user clicks "Update now"
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─── Push notification scaffold (future use) ────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'imiqX', body: 'New update!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
