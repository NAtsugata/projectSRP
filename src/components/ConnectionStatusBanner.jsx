// src/components/ConnectionStatusBanner.jsx
// Bannière automatique de statut connexion Supabase

import { useState, useEffect } from 'react';
import { onConnectionChange, getConnectionState, forceReconnect } from '../utils/connectionMonitor';

export default function ConnectionStatusBanner() {
  const [isOnline, setIsOnline] = useState(getConnectionState());
  const [visible, setVisible] = useState(!getConnectionState()); // Visible si offline au démarrage
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = onConnectionChange((online) => {
      setIsOnline(online);
      setVisible(true);
      setReconnecting(false);

      if (online) {
        // Masquer la bannière verte après 3s
        const timer = setTimeout(() => setVisible(false), 3000);
        return () => clearTimeout(timer);
      }
    });

    return unsubscribe;
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    await forceReconnect();
    // Si toujours offline après 2s, remettre le bouton actif
    setTimeout(() => setReconnecting(false), 2000);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      padding: '10px 16px',
      textAlign: 'center',
      background: isOnline ? '#10b981' : '#ef4444',
      color: 'white',
      fontWeight: 600,
      fontSize: '14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      transition: 'background 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    }}>
      {isOnline ? (
        '✅ Connexion rétablie — Synchronisation en cours...'
      ) : (
        <>
          <span>⚠️ Connexion serveur perdue — Mode hors ligne activé</span>
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            style={{
              background: 'white',
              color: '#ef4444',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: reconnecting ? 'not-allowed' : 'pointer',
              opacity: reconnecting ? 0.7 : 1,
            }}
          >
            {reconnecting ? 'Reconnexion...' : '🔄 Reconnexion'}
          </button>
        </>
      )}
    </div>
  );
}
