import { useState, useEffect } from 'react';
import { onConnectionChange, getConnectionState, forceReconnect } from '../utils/connectionMonitor';

// status: null (hidden) | 'online' | 'offline'
export default function ConnectionStatusBanner() {
  const [status, setStatus] = useState(getConnectionState() ? null : 'offline');
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    return onConnectionChange((online) => {
      setStatus(online ? 'online' : 'offline');
      setReconnecting(false);
      if (online) {
        const timer = setTimeout(() => setStatus(null), 3000);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    await forceReconnect();
    setTimeout(() => setReconnecting(false), 2000);
  };

  if (!status) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      padding: '10px 16px',
      textAlign: 'center',
      background: status === 'online' ? '#10b981' : '#ef4444',
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
      {status === 'online' ? (
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
