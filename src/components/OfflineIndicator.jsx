/**
 * Composant qui affiche une bannière quand l'utilisateur est hors ligne
 * Compatible iOS Safari et Android Chrome
 * Affiche aussi le nombre d'opérations en attente de synchronisation
 */

import React, { useState, useEffect } from 'react';
import { useOnlineStatusFull } from '../hooks/useOnlineStatus';

export default function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, forceSync, hasPendingChanges } = useOnlineStatusFull();
  const [show, setShow] = useState(!isOnline);
  const [wasOnline, setWasOnline] = useState(isOnline);

  useEffect(() => {
    if (isOnline !== wasOnline) {
      if (!isOnline) {
        // Passe hors ligne : afficher immédiatement
        setShow(true);
      } else {
        // Revient en ligne : masquer après 3 secondes (sauf si pending)
        if (!hasPendingChanges) {
          setTimeout(() => setShow(false), 3000);
        }
      }
      setWasOnline(isOnline);
    }
  }, [isOnline, wasOnline, hasPendingChanges]);

  // Afficher si offline, syncing, ou pending changes
  const shouldShow = !isOnline || isSyncing || hasPendingChanges || show;

  if (isOnline && !shouldShow) {
    return null;
  }

  const handleSync = async () => {
    if (isOnline && !isSyncing) {
      await forceSync();
    }
  };

  return (
    <>
      <style>{`
        .offline-indicator {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          background: ${isOnline ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'};
          color: white;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .offline-indicator-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .offline-indicator-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }

        .offline-indicator-text {
          flex: 1;
          text-align: center;
        }

        .offline-indicator-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          line-height: 1;
          transition: all 0.2s;
        }

        .offline-indicator-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .offline-indicator-badge {
          background: rgba(255, 255, 255, 0.3);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .offline-indicator-sync {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: white;
          padding: 4px 12px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .offline-indicator-sync:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.3);
        }

        .offline-indicator-sync:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .sync-spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .offline-indicator {
            font-size: 13px;
            padding: 10px 16px;
          }
        }
      `}</style>

      <div className="offline-indicator">
        <div className="offline-indicator-icon">
          {isSyncing ? (
            <span className="sync-spinner">⟳</span>
          ) : (
            <div className="offline-indicator-pulse"></div>
          )}
        </div>

        <div className="offline-indicator-text">
          {isSyncing ? (
            <>Synchronisation en cours...</>
          ) : isOnline ? (
            hasPendingChanges ? (
              <>{pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente</>
            ) : (
              <>📶 Connexion rétablie !</>
            )
          ) : (
            <>📵 Mode hors ligne {hasPendingChanges && `(${pendingCount} en attente)`}</>
          )}
        </div>

        {/* Badge compteur */}
        {hasPendingChanges && !isSyncing && (
          <span className="offline-indicator-badge">{pendingCount}</span>
        )}

        {/* Bouton sync */}
        {isOnline && hasPendingChanges && (
          <button
            className="offline-indicator-sync"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? '⟳' : 'Sync'}
          </button>
        )}

        {isOnline && !hasPendingChanges && (
          <button
            className="offline-indicator-close"
            onClick={() => setShow(false)}
            aria-label="Fermer"
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
