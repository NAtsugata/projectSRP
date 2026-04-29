// src/components/SyncQualityIndicator.jsx
// Indicateur visuel de qualité de synchronisation

import React, { useState, useEffect } from 'react';
import { getSyncStatus, registerBackgroundSync, SYNC_TAGS } from '../utils/backgroundSync';
import { getPendingCount } from '../utils/syncService';
import logger from '../utils/logger';
import './SyncQualityIndicator.css';

/**
 * Calcule la qualité de la sync
 * @param {Object} status - État de sync
 * @returns {Object} - { quality, color, label }
 */
const calculateSyncQuality = (status) => {
  const { online, hasPending, lastSync, pendingOperations } = status;

  // Hors ligne
  if (!online) {
    return {
      quality: pendingOperations > 0 ? 30 : 60,
      color: 'orange',
      label: 'Hors ligne',
      icon: '📴'
    };
  }

  // En ligne avec des opérations en attente
  if (pendingOperations > 0 || hasPending) {
    return {
      quality: 50,
      color: 'yellow',
      label: 'Synchronisation en cours',
      icon: '🔄'
    };
  }

  // En ligne, sync récente
  const now = Date.now();
  const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
  const minutesSinceSync = (now - lastSyncTime) / 1000 / 60;

  if (minutesSinceSync < 5) {
    return {
      quality: 100,
      color: 'green',
      label: 'Synchronisé',
      icon: '✅'
    };
  }

  if (minutesSinceSync < 30) {
    return {
      quality: 80,
      color: 'lightgreen',
      label: 'Récemment synchronisé',
      icon: '✓'
    };
  }

  // En ligne mais sync ancienne
  return {
    quality: 60,
    color: 'yellow',
    label: 'Sync recommandée',
    icon: '⚠️'
  };
};

/**
 * Composant indicateur de qualité de sync
 */
const SyncQualityIndicator = ({ expanded = false }) => {
  const [syncStatus, setSyncStatus] = useState({
    online: navigator.onLine,
    hasPending: false,
    pendingOperations: 0,
    lastSync: null,
    isSyncing: false
  });

  const [showDetails, setShowDetails] = useState(expanded);

  // Mettre à jour le statut périodiquement
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const bgStatus = await getSyncStatus();
        const pendingOps = await getPendingCount();

        // Obtenir le dernier timestamp de sync depuis localStorage
        const lastSync = localStorage.getItem('last_full_sync');

        setSyncStatus({
          online: navigator.onLine,
          hasPending: bgStatus.hasPending,
          pendingOperations: pendingOps,
          pendingTags: bgStatus.pendingTags || [],
          lastSync,
          supported: bgStatus.supported,
          isSyncing: false
        });

      } catch (error) {
        logger.error('[SyncIndicator] Erreur update status:', error);
      }
    };

    updateStatus();

    // Mettre à jour toutes les 10 secondes
    const interval = setInterval(updateStatus, 10000);

    // Écouter les changements de connexion
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, online: true }));
      updateStatus();
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, online: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculer la qualité
  const quality = calculateSyncQuality(syncStatus);

  // Déclencher une sync manuelle
  const handleManualSync = async () => {
    if (!syncStatus.online) {
      alert('Impossible de synchroniser hors ligne');
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      await registerBackgroundSync(SYNC_TAGS.FULL_SYNC);
      logger.log('[SyncIndicator] Sync manuelle déclenchée');

      // Mettre à jour le timestamp
      localStorage.setItem('last_full_sync', new Date().toISOString());

      // Actualiser le statut après 2 secondes
      setTimeout(() => {
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSync: new Date().toISOString()
        }));
      }, 2000);

    } catch (error) {
      logger.error('[SyncIndicator] Erreur sync manuelle:', error);
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
      alert('Erreur lors de la synchronisation');
    }
  };

  // Formater le temps depuis dernière sync
  const formatLastSync = () => {
    if (!syncStatus.lastSync) return 'Jamais';

    const minutes = Math.floor((Date.now() - new Date(syncStatus.lastSync).getTime()) / 1000 / 60);

    if (minutes < 1) return 'À l\'instant';
    if (minutes === 1) return 'Il y a 1 minute';
    if (minutes < 60) return `Il y a ${minutes} minutes`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Il y a 1 heure';
    if (hours < 24) return `Il y a ${hours} heures`;

    const days = Math.floor(hours / 24);
    return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  };

  return (
    <div className="sync-quality-indicator">
      {/* Barre de qualité compacte */}
      <div
        className="sync-quality-bar"
        onClick={() => setShowDetails(!showDetails)}
        style={{ cursor: 'pointer' }}
        title="Cliquez pour plus de détails"
      >
        <div
          className="sync-quality-fill"
          style={{
            width: `${quality.quality}%`,
            backgroundColor: quality.color,
            transition: 'width 0.3s ease'
          }}
        />

        <div className="sync-quality-label">
          <span className="sync-icon">{quality.icon}</span>
          <span className="sync-text">{quality.label}</span>

          {syncStatus.pendingOperations > 0 && (
            <span className="sync-badge">
              {syncStatus.pendingOperations}
            </span>
          )}
        </div>
      </div>

      {/* Détails étendus */}
      {showDetails && (
        <div className="sync-details">
          <div className="sync-detail-row">
            <span className="sync-detail-label">Connexion:</span>
            <span className={`sync-detail-value ${syncStatus.online ? 'online' : 'offline'}`}>
              {syncStatus.online ? '🟢 En ligne' : '🔴 Hors ligne'}
            </span>
          </div>

          <div className="sync-detail-row">
            <span className="sync-detail-label">Dernière sync:</span>
            <span className="sync-detail-value">
              {formatLastSync()}
            </span>
          </div>

          {syncStatus.pendingOperations > 0 && (
            <div className="sync-detail-row">
              <span className="sync-detail-label">En attente:</span>
              <span className="sync-detail-value warning">
                {syncStatus.pendingOperations} opération{syncStatus.pendingOperations > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {syncStatus.pendingTags && syncStatus.pendingTags.length > 0 && (
            <div className="sync-detail-row">
              <span className="sync-detail-label">Tags sync:</span>
              <span className="sync-detail-value">
                {syncStatus.pendingTags.join(', ')}
              </span>
            </div>
          )}

          {!syncStatus.supported && (
            <div className="sync-detail-row">
              <span className="sync-detail-value warning">
                ⚠️ Background Sync non supporté
              </span>
            </div>
          )}

          {/* Bouton sync manuelle */}
          <button
            className="sync-manual-button"
            onClick={handleManualSync}
            disabled={!syncStatus.online || syncStatus.isSyncing}
          >
            {syncStatus.isSyncing ? (
              <>
                <span className="spinner">⟳</span> Synchronisation...
              </>
            ) : (
              <>
                🔄 Synchroniser maintenant
              </>
            )}
          </button>

          {/* Indicateur de qualité */}
          <div className="sync-quality-meter">
            <div className="sync-quality-meter-fill" style={{ width: `${quality.quality}%`, backgroundColor: quality.color }} />
            <span className="sync-quality-percentage">{quality.quality}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncQualityIndicator;
