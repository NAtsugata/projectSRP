// src/components/SmartPlanningManager.jsx
// Composant intégré : Planification Multi-Jours + Mode Hors Ligne

import React, { useState } from 'react';
import useSmartPlanning from '../hooks/useSmartPlanning';
import SyncQualityIndicator from './SyncQualityIndicator';
import MultiDayScheduler from './MultiDayScheduler';
import './SmartPlanningManager.css';

const SmartPlanningManager = ({ intervention, onSuccess, onCancel }) => {
  const {
    isOnline,
    isSyncing,
    users,
    interventions,
    absences,
    pendingChanges,
    hasPendingChanges,
    createIntervention,
    getSuggestions,
    validate,
    syncAll
  } = useSmartPlanning({
    enableOfflineMode: true,
    enableAutoSync: true,
    enableCache: true
  });

  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  /**
   * Gère la planification confirmée
   */
  const handleSchedule = async (plannedIntervention, validation) => {
    // Vérifier si hors ligne et avertir
    if (!isOnline && !showOfflineWarning) {
      const confirm = window.confirm(
        '⚠️ Vous êtes hors ligne.\n\n' +
        'L\'intervention sera sauvegardée localement et synchronisée automatiquement dès le retour en ligne.\n\n' +
        'Continuer ?'
      );

      if (!confirm) return;
      setShowOfflineWarning(true);
    }

    // Créer l'intervention
    const result = await createIntervention(
      plannedIntervention,
      plannedIntervention.start_date,
      plannedIntervention.duration_days,
      {
        excludeWeekends: intervention.metadata?.excluded_weekends !== false,
        excludePublicHolidays: intervention.metadata?.excluded_holidays !== false
      }
    );

    if (result.success) {
      // Notification succès
      const message = result.offline
        ? `✅ Intervention créée hors ligne\n📤 Sera synchronisée au retour en ligne\n⏱️ ${pendingChanges.length + 1} modification(s) en attente`
        : `✅ Intervention créée et synchronisée`;

      alert(message);

      if (onSuccess) {
        onSuccess(result.intervention, result);
      }
    } else {
      alert(`❌ Erreur: ${result.error}`);
    }
  };

  /**
   * Force une synchronisation manuelle
   */
  const handleManualSync = async () => {
    if (!isOnline) {
      alert('❌ Impossible de synchroniser hors ligne');
      return;
    }

    await syncAll();
    alert(`✅ Synchronisation terminée\n${hasPendingChanges ? `⚠️ ${pendingChanges.length} changement(s) toujours en attente` : '✓ Tout est synchronisé'}`);
  };

  return (
    <div className="smart-planning-manager">
      {/* Header avec statut */}
      <div className="planning-header">
        <h1>📅 Planification Intelligente</h1>

        <div className="header-status">
          {/* Indicateur connexion */}
          <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
            </span>
          </div>

          {/* Indicateur sync */}
          {isSyncing && (
            <div className="syncing-indicator">
              <span className="spinner">⟳</span> Synchronisation...
            </div>
          )}

          {/* Changements en attente */}
          {hasPendingChanges && (
            <div className="pending-changes">
              <span className="badge">{pendingChanges.length}</span>
              <span>modification(s) en attente</span>
              {isOnline && (
                <button onClick={handleManualSync} className="btn-sync-now">
                  🔄 Synchroniser
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bannière hors ligne */}
      {!isOnline && (
        <div className="offline-banner">
          <div className="banner-icon">📴</div>
          <div className="banner-content">
            <strong>Mode Hors Ligne Actif</strong>
            <p>
              Vous pouvez continuer à planifier des interventions.
              Elles seront automatiquement synchronisées au retour en ligne.
            </p>
          </div>
        </div>
      )}

      {/* Composant de planification multi-jours */}
      <div className="planning-content">
        <MultiDayScheduler
          intervention={intervention}
          users={users}
          allInterventions={interventions}
          absences={absences}
          onSchedule={handleSchedule}
          onCancel={onCancel}
        />
      </div>

      {/* Indicateur de qualité de sync (flottant) */}
      <SyncQualityIndicator />

      {/* Debug panel (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-panel">
          <details>
            <summary>🔧 Debug</summary>
            <pre>
              {JSON.stringify({
                isOnline,
                isSyncing,
                users: users.length,
                interventions: interventions.length,
                absences: absences.length,
                pendingChanges: pendingChanges.length
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default SmartPlanningManager;
