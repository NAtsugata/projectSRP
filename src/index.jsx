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
import logger from './utils/logger';
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
    logger.log('PWA prête - Mode hors ligne disponible');
    logger.log('Installation possible sur l\'écran d\'accueil');
  },
  onUpdate: async (registration) => {
    logger.log('Nouvelle version détectée - Mise à jour forcée');

    const waitingServiceWorker = registration.waiting;

    // Créer et afficher le popup de mise à jour
    const updateDiv = document.createElement('div');
    updateDiv.id = 'force-update-overlay';
    updateDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 1rem;
      ">
        <div style="
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          max-width: 400px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="font-size: 4rem; animation: spin 2s linear infinite;">🔄</div>
          <h2 style="color: #fff; font-size: 1.5rem; margin: 1rem 0 0.5rem;">Mise à jour en cours...</h2>
          <p style="color: rgba(255, 255, 255, 0.7); margin: 0;">L'application se recharge automatiquement.</p>
        </div>
      </div>
      <style>
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(updateDiv);

    try {
      // 1. Demander au SW en attente de prendre le contrôle
      if (waitingServiceWorker) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Vider tous les caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        logger.log('Caches vidés:', cacheNames);
      }

      // 3. Attendre un court instant puis recharger
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);

    } catch (error) {
      logger.error('Erreur lors de la mise à jour:', error);
      // Forcer le rechargement quand même
      window.location.reload(true);
    }
  }
});

