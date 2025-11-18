// public/service-worker.js
// Service Worker pour gérer les notifications push natives et le mode hors ligne

// Noms des caches (version unique)
const CACHE_VERSION = 'v2';
const CACHE_NAME = `srp-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `srp-runtime-${CACHE_VERSION}`;
const API_CACHE = `srp-api-${CACHE_VERSION}`;
const NOTIFICATION_TAG = 'srp-notification';

// Liste des caches valides
const VALID_CACHES = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];

// Assets à pré-charger pour mode hors ligne
// IMPORTANT: Ces URLs seront disponibles même si jamais visitées
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Routes de l'app à pré-charger (React Router SPA)
// Toutes ces routes serviront index.html
const APP_ROUTES = [
  '/agenda',
  '/expenses',
  '/dashboard',
  '/planning',
  '/leave',
  '/vault',
  '/users',
  '/archive',
  '/ir-docs',
  '/checklists',
  '/my-documents',
  '/diagnostics'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pré-cache des assets essentiels');
        // Essayer de pré-charger, mais ne pas bloquer l'installation si ça échoue
        return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('[Service Worker] Erreur pré-cache (non bloquant):', err);
        });
      })
      .then(() => {
        console.log('[Service Worker] Installation terminée');
        return self.skipWaiting(); // Activer immédiatement
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');

  // Nettoyer les anciens caches (garder seulement la version actuelle)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Supprimer les caches qui ne sont pas dans VALID_CACHES
          if (!VALID_CACHES.includes(cacheName) && cacheName.startsWith('srp-')) {
            console.log('[Service Worker] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation terminée');
      return self.clients.claim(); // Prendre le contrôle immédiatement
    })
  );
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push reçu:', event);

  let data = {
    title: 'Nouvelle notification',
    body: 'Vous avez une nouvelle notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: NOTIFICATION_TAG,
    requireInteraction: true,
    data: {}
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Gestion du clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification cliquée:', event);

  event.notification.close();

  // Gérer les actions spécifiques
  if (event.action === 'dismiss') {
    console.log('[Service Worker] Notification ignorée');
    return;
  }

  // Construire l'URL complète
  const urlPath = event.notification.data?.url || '/';
  const urlToOpen = new URL(urlPath, self.location.origin).href;

  console.log('[Service Worker] URL à ouvrir:', urlToOpen);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('[Service Worker] Clients trouvés:', clientList.length);

      // Chercher une fenêtre déjà ouverte de l'app
      for (let client of clientList) {
        const clientOrigin = new URL(client.url).origin;
        if (clientOrigin === self.location.origin && 'focus' in client && 'navigate' in client) {
          console.log('[Service Worker] Navigation vers:', urlToOpen);
          return client.navigate(urlToOpen).then(client => client.focus());
        }
      }

      // Sinon, ouvrir une nouvelle fenêtre
      if (self.clients.openWindow) {
        console.log('[Service Worker] Ouverture nouvelle fenêtre:', urlToOpen);
        return self.clients.openWindow(urlToOpen);
      }
    }).catch(error => {
      console.error('[Service Worker] Erreur navigation:', error);
    })
  );
});

// Gestion de la fermeture de la notification
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification fermée:', event);
});

// ========================================
// MODE HORS LIGNE - CACHE INTELLIGENT
// ========================================
// RUNTIME_CACHE et API_CACHE sont définis en haut du fichier

// Intercepter les requêtes pour le mode hors ligne
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Ignorer les requêtes de mutation (POST, PUT, DELETE, PATCH)
  // Laisser passer les uploads/downloads sans intercepter
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes vers Supabase Storage (uploads/downloads)
  if (url.pathname.includes('/storage/v1/')) {
    return;
  }

  // Stratégie selon le type de requête
  if (isApiRequest(url)) {
    // API Supabase: Network-First avec cache fallback
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isStaticAsset(request, url)) {
    // Assets statiques: Cache-First
    event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
  } else if (request.destination === 'document' || isAppRoute(url)) {
    // Pages HTML et routes de l'app: Servir index.html (React Router SPA)
    event.respondWith(handleNavigationRequest(request, url));
  }
});

/**
 * Vérifie si c'est une route de l'app React
 */
function isAppRoute(url) {
  // Vérifier si l'URL correspond à une route de l'app
  // Exemple: /agenda, /expenses, /dashboard, etc.
  const pathname = url.pathname;

  // Ignore les fichiers avec extension
  if (pathname.match(/\.[a-z]+$/i)) {
    return false;
  }

  // Vérifier si ça correspond à une route connue
  return APP_ROUTES.some(route => pathname.startsWith(route)) || pathname === '/';
}

/**
 * Gère les requêtes de navigation (routes React Router)
 * Sert toujours index.html pour que React Router gère le routing
 */
async function handleNavigationRequest(request, url) {
  try {
    // 1. Essayer le réseau d'abord
    const networkResponse = await fetchWithTimeout(request, 5000);

    // 2. Mettre en cache
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // 3. Mode hors ligne : servir index.html depuis le cache
    console.log('[SW] Mode hors ligne - Serving index.html pour:', url.pathname);

    // Essayer de servir index.html en cache
    const cachedIndex = await caches.match('/');
    if (cachedIndex) {
      return cachedIndex;
    }

    // Fallback: essayer /index.html
    const cachedIndexHtml = await caches.match('/index.html');
    if (cachedIndexHtml) {
      return cachedIndexHtml;
    }

    // Dernier fallback: page offline
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

    // Si vraiment rien ne fonctionne
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Vérifie si c'est une requête API Supabase
 */
function isApiRequest(url) {
  return (url.hostname.includes('supabase.co') &&
          (url.pathname.startsWith('/rest/v1/') ||
           url.pathname.startsWith('/auth/v1/')));
}

/**
 * Vérifie si c'est un asset statique
 */
function isStaticAsset(request, url) {
  return request.destination === 'script' ||
         request.destination === 'style' ||
         request.destination === 'image' ||
         request.destination === 'font' ||
         url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|ico)$/);
}

/**
 * Stratégie Cache-First
 * Vérifie le cache d'abord, sinon réseau
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    // 1. Chercher dans le cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 2. Si pas en cache, aller sur le réseau
    const networkResponse = await fetch(request);

    // 3. Mettre en cache pour la prochaine fois
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Fallback: essayer le cache même si expiré
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback ultime: page offline pour les pages HTML
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

/**
 * Stratégie Network-First
 * Essaie le réseau d'abord, sinon cache
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    // 1. Essayer le réseau avec timeout
    const networkResponse = await fetchWithTimeout(request, 5000);

    // 2. Mettre en cache si succès
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // 3. Fallback vers le cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 4. Fallback ultime pour les pages HTML
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
    }

    // 5. Réponse d'erreur JSON pour les APIs
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'Vous êtes hors ligne et cette ressource n\'est pas en cache'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }
    );
  }
}

/**
 * Fetch avec timeout
 */
function fetchWithTimeout(request, timeout = 5000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

/**
 * Message du client vers le Service Worker
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(name => name.startsWith('srp-'))
                    .map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});
