// public/service-worker.js
// Service Worker pour gérer les notifications push natives

const CACHE_NAME = 'srp-app-v2';
const NOTIFICATION_TAG = 'srp-notification';

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...');
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');

  // Nettoyer les anciens caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
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

// ✅ IMPORTANT: Passer tous les fetch au réseau (ne pas intercepter)
// Cela évite les erreurs "Request interrupted by user" lors des uploads/downloads
self.addEventListener('fetch', (event) => {
  // Ne rien faire - laisser passer toutes les requêtes normalement
  // Pas de event.respondWith() = requêtes passent directement au réseau
  return;
});
