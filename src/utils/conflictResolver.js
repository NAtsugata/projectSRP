// src/utils/conflictResolver.js
// Système intelligent de résolution de conflits pour le mode hors ligne

import logger from './logger';

/**
 * Types de stratégies de résolution
 */
export const RESOLUTION_STRATEGIES = {
  LAST_WRITE_WINS: 'last_write_wins',      // Le plus récent gagne
  MANUAL: 'manual',                         // Demander à l'utilisateur
  MERGE: 'merge',                          // Fusionner intelligemment
  SERVER_WINS: 'server_wins',              // Le serveur a toujours raison
  CLIENT_WINS: 'client_wins'               // Le client a toujours raison
};

/**
 * Détecte les conflits entre version locale et serveur
 * @param {Object} localData - Données locales
 * @param {Object} serverData - Données serveur
 * @returns {Object} - { hasConflict, conflicts, resolution }
 */
export const detectConflict = (localData, serverData) => {
  if (!localData || !serverData) {
    return { hasConflict: false, conflicts: [] };
  }

  // Comparer les timestamps de modification
  const localUpdated = new Date(localData.updated_at || localData.modified_at || 0);
  const serverUpdated = new Date(serverData.updated_at || serverData.modified_at || 0);

  // Si les timestamps sont identiques, pas de conflit
  if (localUpdated.getTime() === serverUpdated.getTime()) {
    return { hasConflict: false, conflicts: [] };
  }

  // Si le serveur a une version plus récente
  if (serverUpdated > localUpdated) {
    return {
      hasConflict: true,
      serverNewer: true,
      conflicts: findFieldDifferences(localData, serverData),
      localTimestamp: localUpdated,
      serverTimestamp: serverUpdated
    };
  }

  // Si le client a une version plus récente
  return {
    hasConflict: true,
    serverNewer: false,
    conflicts: findFieldDifferences(localData, serverData),
    localTimestamp: localUpdated,
    serverTimestamp: serverUpdated
  };
};

/**
 * Trouve les différences entre deux objets
 * @param {Object} obj1 - Premier objet
 * @param {Object} obj2 - Deuxième objet
 * @returns {Array} - Liste des champs différents
 */
const findFieldDifferences = (obj1, obj2) => {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    // Ignorer les champs système
    if (['id', 'created_at', 'updated_at', 'modified_at', '_version'].includes(key)) {
      continue;
    }

    const val1 = obj1[key];
    const val2 = obj2[key];

    // Comparer en profondeur si c'est un objet
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push({
          field: key,
          localValue: val1,
          serverValue: val2,
          type: 'object'
        });
      }
    } else if (val1 !== val2) {
      differences.push({
        field: key,
        localValue: val1,
        serverValue: val2,
        type: typeof val1
      });
    }
  }

  return differences;
};

/**
 * Résout un conflit selon la stratégie choisie
 * @param {Object} conflict - Informations du conflit
 * @param {string} strategy - Stratégie de résolution
 * @param {Object} options - Options supplémentaires
 * @returns {Object} - Données résolues
 */
export const resolveConflict = (conflict, strategy = RESOLUTION_STRATEGIES.LAST_WRITE_WINS, options = {}) => {
  const { localData, serverData } = conflict;

  switch (strategy) {
    case RESOLUTION_STRATEGIES.LAST_WRITE_WINS:
      return resolveLastWriteWins(conflict);

    case RESOLUTION_STRATEGIES.SERVER_WINS:
      logger.log('[ConflictResolver] Stratégie SERVER_WINS - Serveur prioritaire');
      return {
        resolved: serverData,
        strategy: 'server_wins',
        reason: 'Serveur toujours prioritaire'
      };

    case RESOLUTION_STRATEGIES.CLIENT_WINS:
      logger.log('[ConflictResolver] Stratégie CLIENT_WINS - Client prioritaire');
      return {
        resolved: localData,
        strategy: 'client_wins',
        reason: 'Client toujours prioritaire'
      };

    case RESOLUTION_STRATEGIES.MERGE:
      return resolveMerge(conflict, options);

    case RESOLUTION_STRATEGIES.MANUAL:
      return {
        resolved: null,
        strategy: 'manual',
        needsUserInput: true,
        conflict
      };

    default:
      return resolveLastWriteWins(conflict);
  }
};

/**
 * Résolution Last-Write-Wins (le plus récent gagne)
 */
const resolveLastWriteWins = (conflict) => {
  const { localData, serverData, localTimestamp, serverTimestamp } = conflict;

  if (serverTimestamp > localTimestamp) {
    logger.log('[ConflictResolver] Last-Write-Wins: Serveur plus récent');
    return {
      resolved: serverData,
      strategy: 'last_write_wins',
      winner: 'server',
      reason: `Serveur plus récent (${serverTimestamp.toISOString()})`
    };
  }

  logger.log('[ConflictResolver] Last-Write-Wins: Client plus récent');
  return {
    resolved: localData,
    strategy: 'last_write_wins',
    winner: 'client',
    reason: `Client plus récent (${localTimestamp.toISOString()})`
  };
};

/**
 * Résolution par fusion intelligente
 */
const resolveMerge = (conflict, options = {}) => {
  const { localData, serverData, conflicts } = conflict;
  const merged = { ...serverData }; // Partir de la base serveur

  // Pour chaque différence, appliquer des règles de fusion
  conflicts.forEach(diff => {
    const { field, localValue, serverValue } = diff;

    // Règles spécifiques par champ
    switch (field) {
      case 'status':
        // Le statut le plus avancé gagne
        merged[field] = mergeStatus(localValue, serverValue);
        break;

      case 'notes':
      case 'description':
      case 'comment':
        // Fusionner les textes
        merged[field] = mergeText(localValue, serverValue);
        break;

      case 'tags':
      case 'assigned_to':
        // Fusionner les tableaux (union)
        merged[field] = mergeArrays(localValue, serverValue);
        break;

      default:
        // Par défaut, garder la valeur locale si elle existe
        if (localValue !== null && localValue !== undefined && localValue !== '') {
          merged[field] = localValue;
        }
    }
  });

  logger.log('[ConflictResolver] Fusion réalisée:', merged);
  return {
    resolved: merged,
    strategy: 'merge',
    mergedFields: conflicts.map(c => c.field),
    reason: 'Fusion intelligente des modifications'
  };
};

/**
 * Fusionne les statuts (le plus avancé gagne)
 */
const mergeStatus = (status1, status2) => {
  const statusPriority = {
    'pending': 1,
    'scheduled': 2,
    'in_progress': 3,
    'completed': 4,
    'cancelled': 5
  };

  const priority1 = statusPriority[status1] || 0;
  const priority2 = statusPriority[status2] || 0;

  return priority1 >= priority2 ? status1 : status2;
};

/**
 * Fusionne les textes (concaténation intelligente)
 */
const mergeText = (text1, text2) => {
  if (!text1) return text2;
  if (!text2) return text1;
  if (text1 === text2) return text1;

  // Si l'un contient l'autre, garder le plus long
  if (text1.includes(text2)) return text1;
  if (text2.includes(text1)) return text2;

  // Sinon, concaténer avec séparateur
  return `${text1}\n\n[Ajout serveur]\n${text2}`;
};

/**
 * Fusionne les tableaux (union)
 */
const mergeArrays = (arr1, arr2) => {
  if (!Array.isArray(arr1)) return arr2;
  if (!Array.isArray(arr2)) return arr1;

  // Union sans doublons
  return [...new Set([...arr1, ...arr2])];
};

/**
 * Ajoute un numéro de version à un objet
 * @param {Object} data - Données à versionner
 * @returns {Object} - Données avec version
 */
export const addVersion = (data) => {
  return {
    ...data,
    _version: (data._version || 0) + 1,
    _modified_at: new Date().toISOString(),
    _client_id: getClientId()
  };
};

/**
 * Obtient un ID unique pour ce client
 * @returns {string} - ID client
 */
const getClientId = () => {
  let clientId = localStorage.getItem('srp_client_id');
  if (!clientId) {
    clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('srp_client_id', clientId);
  }
  return clientId;
};

/**
 * Valide si les données peuvent être synchronisées
 * @param {Object} data - Données à valider
 * @returns {Object} - { valid, errors }
 */
export const validateSyncData = (data) => {
  const errors = [];

  // Vérifier les champs obligatoires
  if (!data.id) {
    errors.push('ID manquant');
  }

  // Vérifier le timestamp
  if (!data.updated_at && !data.modified_at && !data._modified_at) {
    errors.push('Timestamp de modification manquant');
  }

  // Vérifier la cohérence des données
  if (data.date && isNaN(new Date(data.date).getTime())) {
    errors.push('Date invalide');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Crée un snapshot de l'état actuel (pour rollback)
 * @param {Object} data - Données à sauvegarder
 * @returns {Object} - Snapshot
 */
export const createSnapshot = (data) => {
  return {
    data: JSON.parse(JSON.stringify(data)), // Deep clone
    timestamp: new Date().toISOString(),
    clientId: getClientId()
  };
};

/**
 * Log des conflits pour analyse
 * @param {Object} conflict - Conflit détecté
 * @param {Object} resolution - Résolution appliquée
 */
export const logConflict = (conflict, resolution) => {
  const log = {
    timestamp: new Date().toISOString(),
    conflict: {
      localTimestamp: conflict.localTimestamp,
      serverTimestamp: conflict.serverTimestamp,
      fieldsAffected: conflict.conflicts?.map(c => c.field)
    },
    resolution: {
      strategy: resolution.strategy,
      winner: resolution.winner,
      reason: resolution.reason
    }
  };

  logger.log('[ConflictResolver] Conflit résolu:', log);

  // Optionnel : Sauvegarder dans IndexedDB pour analyse
  // saveConflictLog(log);
};

export default {
  RESOLUTION_STRATEGIES,
  detectConflict,
  resolveConflict,
  addVersion,
  validateSyncData,
  createSnapshot,
  logConflict
};
