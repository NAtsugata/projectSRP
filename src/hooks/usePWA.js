import { useState, useEffect, useCallback } from 'react';

// Hook principal SW + install prompt
export function usePWA() {
  const [swStatus, setSwStatus] = useState('idle'); // idle | registered | error
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Détecter iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Détecter si déjà installé
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(installed);

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      registerSW();
    }

    // Écouter le prompt d'installation Android/Chrome
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Détecter installation réussie
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const registerSW = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      setSwStatus('registered');

      // Écouter les mises à jour
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      // Vérifier les mises à jour toutes les 30 minutes
      setInterval(() => reg.update(), 30 * 60 * 1000);

    } catch (err) {
      console.error('SW registration failed:', err);
      setSwStatus('error');
    }
  };

  // Déclencher l'installation sur Android
  const triggerInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!installPrompt) return;
    const result = await installPrompt.prompt();
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  }, [installPrompt, isIOS]);

  // Recharger pour appliquer la mise à jour
  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, []);

  const canInstall = !isInstalled && (!!installPrompt || isIOS);

  return {
    swStatus,
    updateAvailable,
    canInstall,
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    triggerInstall,
    applyUpdate,
  };
}

// ============================================================
// Composant bannière "Installer l'app"
// ============================================================
export function PWAInstallBanner() {
  const { canInstall, isIOS, showIOSGuide, setShowIOSGuide, triggerInstall, updateAvailable, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('pwa-banner-dismissed') === 'true';
  });

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (updateAvailable) {
    return (
      <div style={styles.banner}>
        <span style={styles.icon}>🔄</span>
        <div style={styles.text}>
          <strong>Mise à jour disponible</strong>
          <span>Une nouvelle version est prête</span>
        </div>
        <button onClick={applyUpdate} style={styles.btnPrimary}>Mettre à jour</button>
      </div>
    );
  }

  if (!canInstall || dismissed) return null;

  return (
    <>
      <div style={styles.banner}>
        <img src="/icons/icon-48x48.png" alt="SRP" style={{ width: 36, height: 36, borderRadius: 8 }} />
        <div style={styles.text}>
          <strong>Installer l'app</strong>
          <span>Accès rapide depuis l'écran d'accueil</span>
        </div>
        <button onClick={triggerInstall} style={styles.btnPrimary}>Installer</button>
        <button onClick={dismiss} style={styles.btnClose}>✕</button>
      </div>

      {/* Guide iOS */}
      {showIOSGuide && isIOS && (
        <div style={styles.overlay} onClick={() => setShowIOSGuide(false)}>
          <div style={styles.iosGuide} onClick={e => e.stopPropagation()}>
            <div style={styles.iosTitle}>Installer sur iPhone / iPad</div>
            <div style={styles.iosStep}>
              <span style={styles.iosNum}>1</span>
              <span>Appuyez sur <strong>Partager</strong> <span style={{ fontSize: 18 }}>⎙</span> en bas de Safari</span>
            </div>
            <div style={styles.iosStep}>
              <span style={styles.iosNum}>2</span>
              <span>Faites défiler et appuyez sur <strong>Sur l'écran d'accueil</strong></span>
            </div>
            <div style={styles.iosStep}>
              <span style={styles.iosNum}>3</span>
              <span>Appuyez sur <strong>Ajouter</strong> en haut à droite</span>
            </div>
            <button onClick={() => setShowIOSGuide(false)} style={styles.btnClose2}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  banner: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff',
    borderTop: '1px solid #E5E7EB',
    padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    zIndex: 9999,
    boxShadow: '0 -4px 20px rgba(0,0,0,.08)',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
  },
  icon: { fontSize: 28, flexShrink: 0 },
  text: {
    flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
    '& strong': { fontSize: 14, fontWeight: 600, color: '#111827' },
    '& span': { fontSize: 12, color: '#6B7280' },
  },
  btnPrimary: {
    flexShrink: 0, padding: '8px 14px',
    background: '#CD7F32', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnClose: {
    flexShrink: 0, padding: '6px 10px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#9CA3AF', fontSize: 16,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  iosGuide: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    padding: '24px 24px max(24px, env(safe-area-inset-bottom))',
    width: '100%', maxWidth: 500,
  },
  iosTitle: { fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#111827' },
  iosStep: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    marginBottom: 16, fontSize: 14, color: '#374151', lineHeight: 1.5,
  },
  iosNum: {
    width: 28, height: 28, borderRadius: '50%',
    background: '#CD7F32', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  btnClose2: {
    width: '100%', padding: '14px', marginTop: 8,
    background: '#F3F4F6', border: 'none', borderRadius: 12,
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#374151',
  },
};
