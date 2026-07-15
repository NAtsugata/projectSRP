// src/hooks/useSmartPlanning.js
// Hook React combinant Mode Hors Ligne V2 + Planification Multi-Jours

import { useState, useEffect, useCallback } from 'react';
import { createMultiDayIntervention, rescheduleIntervention } from '../utils/smartScheduler';
import { autoAssignTechnicians } from '../utils/autoAssignment';
import { validateScheduling } from '../utils/conflictDetection';
import { generateSchedulingSuggestions } from '../utils/schedulingSuggestions';
import { syncWithDelta } from '../utils/deltaSync';
import { smartSync } from '../utils/backgroundSync';
import { cacheSet, cacheGet, cacheIsValid } from '../utils/smartCache';
import { STORES_ENUM } from '../utils/offlineStorage';
import logger from '../utils/logger';

/**
 * Hook pour la planification intelligente avec support hors ligne
 * @param {Object} options - Options de configuration
 * @returns {Object} - Méthodes et état
 */
export const useSmartPlanning = (options = {}) => {
  const {
    enableOfflineMode = true,
    enableAutoSync = true,
    enableCache = true,
    cacheTTL = 60 * 60 * 1000 // 1 heure par défaut
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [interventions, setInterventions] = useState([]);
  const [users, setUsers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);

  // Écouter changements de connexion
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (enableAutoSync) {
        syncAll();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableAutoSync]);

  /**
   * Charge les données (cache ou serveur)
   */
  const loadData = useCallback(async () => {
    try {
      // 1. Essayer cache d'abord si activé
      if (enableCache) {
        const cachedInterventions = await cacheGet(STORES_ENUM.INTERVENTIONS);
        const cachedUsers = await cacheGet(STORES_ENUM.PROFILES);

        if (cachedInterventions && cachedUsers) {
          setInterventions(cachedInterventions);
          setUsers(cachedUsers);
          logger.log('[SmartPlanning] Données chargées depuis cache');

          // Sync en arrière-plan si en ligne
          if (isOnline && enableAutoSync) {
            syncAll(true); // background
          }

          return;
        }
      }

      // 2. Charger depuis serveur si en ligne
      if (isOnline) {
        await syncAll();
      } else {
        logger.warn('[SmartPlanning] Hors ligne et pas de cache disponible');
      }

    } catch (error) {
      logger.error('[SmartPlanning] Erreur chargement données:', error);
    }
  }, [enableCache, isOnline, enableAutoSync]);

  /**
   * Synchronise toutes les données
   */
  const syncAll = useCallback(async (background = false) => {
    if (!isOnline) {
      logger.log('[SmartPlanning] Hors ligne, sync ignorée');
      return;
    }

    if (!background) setIsSyncing(true);

    try {
      // Sync avec Delta pour économiser bande passante
      const results = await Promise.all([
        syncWithDelta('interventions', STORES_ENUM.INTERVENTIONS),
        syncWithDelta('profiles', STORES_ENUM.PROFILES),
        syncWithDelta('leave_requests', STORES_ENUM.LEAVE_REQUESTS)
      ]);

      // Récupérer données fraîches
      const [itvResult, usersResult, absResult] = results;

      if (itvResult.success) {
        const freshInterventions = await cacheGet(STORES_ENUM.INTERVENTIONS);
        setInterventions(freshInterventions || []);
      }

      if (usersResult.success) {
        const freshUsers = await cacheGet(STORES_ENUM.PROFILES);
        setUsers(freshUsers || []);
      }

      if (absResult.success) {
        const freshAbsences = await cacheGet(STORES_ENUM.LEAVE_REQUESTS);
        setAbsences(freshAbsences || []);
      }

      logger.log('[SmartPlanning] Sync complète réussie');

    } catch (error) {
      logger.error('[SmartPlanning] Erreur sync:', error);
    } finally {
      if (!background) setIsSyncing(false);
    }
  }, [isOnline]);

  /**
   * Crée une intervention multi-jours (hors ligne compatible)
   */
  const createIntervention = useCallback(async (baseIntervention, startDate, duration, planningOptions = {}) => {
    try {
      // 1. Générer planning multi-jours
      const planned = createMultiDayIntervention(
        baseIntervention,
        startDate,
        duration,
        planningOptions
      );

      // 2. Auto-assigner techniciens
      const assignment = autoAssignTechnicians(
        planned,
        users,
        { absences, existingAssignments: {}, allUsers: users }
      );

      // 3. Enrichir avec assignations
      planned.intervention_assignments = assignment.assignedUsers.map(id => ({ user_id: id }));
      planned.daily_assignments = assignment.dailyAssignments;
      planned._assignment_confidence = assignment.confidence;

      // 4. Valider
      const validation = validateScheduling(planned, {
        users,
        allInterventions: interventions,
        absences
      });

      if (!validation.canProceed) {
        throw new Error('Planification impossible: conflits bloquants');
      }

      // 5. Sauvegarder
      if (isOnline) {
        // En ligne: sauvegarder direct + sync
        // TODO: Appel API saveIntervention
        logger.log('[SmartPlanning] Sauvegarde en ligne');

        // Trigger sync
        smartSync('create', 'intervention');

      } else if (enableOfflineMode) {
        // Hors ligne: marquer pour sync future
        planned._local_only = true;
        planned._pending_sync = true;
        planned._created_offline = new Date().toISOString();

        // Sauvegarder dans cache
        await cacheSet(STORES_ENUM.INTERVENTIONS, planned);

        // Ajouter aux pending
        setPendingChanges(prev => [...prev, {
          type: 'create',
          entity: 'intervention',
          data: planned,
          timestamp: new Date().toISOString()
        }]);

        logger.log('[SmartPlanning] Intervention créée hors ligne');
      }

      // Mettre à jour état local
      setInterventions(prev => [...prev, planned]);

      return {
        success: true,
        intervention: planned,
        assignment,
        validation,
        offline: !isOnline
      };

    } catch (error) {
      logger.error('[SmartPlanning] Erreur création:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [users, absences, interventions, isOnline, enableOfflineMode]);

  /**
   * Modifie une intervention existante
   */
  const updateIntervention = useCallback(async (interventionId, updates) => {
    try {
      const existing = interventions.find(i => i.id === interventionId);
      if (!existing) {
        throw new Error('Intervention non trouvée');
      }

      const updated = { ...existing, ...updates };

      if (isOnline) {
        // TODO: Appel API update
        smartSync('update', 'intervention');
      } else if (enableOfflineMode) {
        updated._pending_sync = true;
        updated._modified_offline = new Date().toISOString();
        await cacheSet(STORES_ENUM.INTERVENTIONS, updated);

        setPendingChanges(prev => [...prev, {
          type: 'update',
          entity: 'intervention',
          id: interventionId,
          data: updates,
          timestamp: new Date().toISOString()
        }]);
      }

      setInterventions(prev => prev.map(i => i.id === interventionId ? updated : i));

      return { success: true, intervention: updated, offline: !isOnline };

    } catch (error) {
      logger.error('[SmartPlanning] Erreur mise à jour:', error);
      return { success: false, error: error.message };
    }
  }, [interventions, isOnline, enableOfflineMode]);

  /**
   * Replanifie une intervention multi-jours
   */
  const reschedule = useCallback(async (interventionId, newStartDate, newDuration) => {
    try {
      const existing = interventions.find(i => i.id === interventionId);
      if (!existing) {
        throw new Error('Intervention non trouvée');
      }

      const rescheduled = rescheduleIntervention(existing, newStartDate, newDuration);

      // Re-valider
      const validation = validateScheduling(rescheduled, {
        users,
        allInterventions: interventions.filter(i => i.id !== interventionId),
        absences
      });

      if (!validation.canProceed) {
        throw new Error('Replanification impossible: conflits bloquants');
      }

      // Sauvegarder
      await updateIntervention(interventionId, rescheduled);

      return {
        success: true,
        intervention: rescheduled,
        validation,
        offline: !isOnline
      };

    } catch (error) {
      logger.error('[SmartPlanning] Erreur replanification:', error);
      return { success: false, error: error.message };
    }
  }, [interventions, users, absences, isOnline, updateIntervention]);

  /**
   * Obtient des suggestions de planification
   */
  const getSuggestions = useCallback((intervention, preferences = {}) => {
    const context = {
      users,
      allInterventions: interventions,
      absences
    };

    return generateSchedulingSuggestions(intervention, context, preferences);
  }, [users, interventions, absences]);

  /**
   * Valide une planification
   */
  const validate = useCallback((intervention) => {
    return validateScheduling(intervention, {
      users,
      allInterventions: interventions,
      absences
    });
  }, [users, interventions, absences]);

  // Charger au montage
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    // État
    isOnline,
    isSyncing,
    interventions,
    users,
    absences,
    pendingChanges,
    hasPendingChanges: pendingChanges.length > 0,

    // Actions
    createIntervention,
    updateIntervention,
    reschedule,
    getSuggestions,
    validate,
    syncAll,
    loadData
  };
};

export default useSmartPlanning;
