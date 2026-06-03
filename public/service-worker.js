/* Portail SRP - Service Worker v11
 * Stratégie : Cache First pour assets statiques, Network First pour API
 */
const SW_VERSION = 'srp-v11';
const CACHE_STATIC = `${SW_VERSION}-static`;
const CACHE_PAGES  = `${SW_VERSION}-pages`;

// Assets à précacher au premier install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC && key !== CACHE_PAGES)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer : requêtes non-GET, Supabase API, Edge Functions, extensions
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('supabase.in')) return;
  if (url.pathname.startsWith('/functions/')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Assets statiques (JS, CSS, images, fonts) → Cache First
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/splash/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Pages HTML → Network First avec fallback cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Tout le reste → Network First
  event.respondWith(networkFirst(request, CACHE_PAGES));
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Portail SRP', body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: data.tag || 'srp-notif',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Portail SRP', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const match = wins.find(w => w.url.includes(url) && 'focus' in w);
      if (match) return match.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== BACKGROUND SYNC (pour les formulaires offline) =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-expenses') {
    event.waitUntil(syncExpenses());
  }
  if (event.tag === 'sync-interventions') {
    event.waitUntil(syncInterventions());
  }
});

async function syncExpenses() {
  // Récupérer les dépenses en attente de sync depuis IndexedDB
  // (La logique est dans le frontend - ici on signale juste qu'on est en ligne)
  const wins = await clients.matchAll({ type: 'window' });
  wins.forEach(w => w.postMessage({ type: 'SYNC_READY', entity: 'expenses' }));
}

async function syncInterventions() {
  const wins = await clients.matchAll({ type: 'window' });
  wins.forEach(w => w.postMessage({ type: 'SYNC_READY', entity: 'interventions' }));
}

// ===== HELPERS =====
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Ressource non disponible hors ligne', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Hors ligne', { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_PAGES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback vers la page offline
    const offline = await caches.match('/offline.html');
    return offline || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
