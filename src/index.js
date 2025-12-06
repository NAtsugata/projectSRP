import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import './index.css';
import './styles/mobile-enhancements.css';
import './styles/mobile-dashboard.css'; // 🌙 Thème dark unifié mobile
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import reportWebVitals from './reportWebVitals';
import { initMobileOptimizations } from './utils/mobileUtils';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { initCacheCleanup } from './utils/indexedDBCache';
// ✅ Désactiver console.log en production pour réduire l'exposition d'informations sensibles
import './utils/consoleOverride';

// Initialize mobile optimizations (fast-click, touch detection, etc.)
initMobileOptimizations();

// Initialize cache cleanup (remove old uploads)
initCacheCleanup();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();

// Enregistrer le Service Worker pour PWA et mode hors ligne
// En production, cela permet :
// - Installation comme app native (iOS, Android, Desktop)
// - Fonctionnement hors ligne
// - Cache intelligent des assets et données
// ✅ RÉACTIVÉ - PWA Mode actif
serviceWorkerRegistration.register({
  onSuccess: (registration) => {
    console.log('✅ PWA prête - Mode hors ligne disponible');
    console.log('📱 Installation possible sur l\'écran d\'accueil');
  },
  onUpdate: (registration) => {
    console.log('🔄 Nouvelle version disponible');
    const waitingServiceWorker = registration.waiting;
    if (waitingServiceWorker) {
      // Afficher notification de mise à jour
      if (window.confirm('Une nouvelle version est disponible. Rafraîchir maintenant ?')) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        waitingServiceWorker.addEventListener("statechange", event => {
          if (event.target.state === "activated") {
            window.location.reload();
          }
        });
      }
    }
  }
});

