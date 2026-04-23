// src/components/ConnectionStatusBanner.jsx
// Bannière automatique de statut connexion Supabase

import { useState, useEffect } from 'react';
import { onConnectionChange, getConnectionState } from '../utils/connectionMonitor';

export default function ConnectionStatusBanner() {
  const [isOnline, setIsOnline] = useState(getConnectionState());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onConnectionChange((online) => {
      setIsOnline(online);
      setVisible(true);

      if (online) {
        // Masquer la bannière verte après 3s
        const timer = setTimeout(() => setVisible(false), 3000);
        return () => clearTimeout(timer);
      }
    });

    return unsubscribe;
  }, []);

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
    }}>
      {isOnline
        ? '✅ Connexion rétablie — Synchronisation en cours...'
        : '⚠️ Connexion serveur perdue — Mode hors ligne activé'}
    </div>
  );
}
