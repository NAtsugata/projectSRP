/**
 * Service Worker Registration
 * Enregistre le Service Worker pour PWA et mode hors ligne
 * Compatible iOS Safari, Android Chrome, Desktop
 */

// Vérifie si on est en production
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  // ✅ Enregistrer le Service Worker en production ET en développement
  // Le Service Worker fonctionne sur localhost pour faciliter les tests
  if ('serviceWorker' in navigator) {
    // URL du Service Worker
    const publicUrl = new URL(process.env.PUBLIC_URL || '', window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Notre Service Worker ne fonctionnera pas si PUBLIC_URL est sur un domaine différent
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // En localhost, vérifier que le Service Worker existe
        checkValidServiceWorker(swUrl, config);

        // Ajouter du logging pour le développement
        navigator.serviceWorker.ready.then(() => {
          console.log(
            '✅ Service Worker actif. App peut fonctionner hors ligne.\n' +
            'En savoir plus: https://cra.link/PWA'
          );
        });
      } else {
        // En production, enregistrer directement
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('✅ Service Worker enregistré:', registration.scope);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Nouveau contenu disponible
              console.log('🔄 Nouveau contenu disponible. Rafraîchir pour voir les changements.');

              // Exécuter le callback si fourni
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // Contenu en cache pour utilisation hors ligne
              console.log('✅ Contenu en cache. App prête pour mode hors ligne.');

              // Exécuter le callback si fourni
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('❌ Erreur enregistrement Service Worker:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Vérifier que le Service Worker existe
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // S'assurer que le Service Worker existe et est valide
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Service Worker non trouvé. Recharger la page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service Worker trouvé. Continuer normalement.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('❌ Pas de connexion internet. App en mode hors ligne.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('✅ Service Worker désenregistré');
      })
      .catch((error) => {
        console.error('❌ Erreur désenregistrement:', error.message);
      });
  }
}

// Fonction pour forcer la mise à jour du Service Worker
export function update() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.update();
        console.log('🔄 Vérification mise à jour Service Worker...');
      }
    });
  }
}

// Fonction pour envoyer un message au Service Worker
export function sendMessage(message) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

// Fonction pour vider le cache
export function clearCache() {
  sendMessage({ type: 'CLEAR_CACHE' });
  console.log('🗑️ Demande de nettoyage du cache envoyée');
}
