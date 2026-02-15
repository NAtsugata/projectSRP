// src/utils/orgHelper.js
// Helper centralisé pour injecter organization_id dans les opérations Supabase.
// Chaque service utilise getOrgId() pour récupérer l'organization_id
// depuis le profil de l'utilisateur connecté (authStore).

import { useAuthStore } from '../store/authStore';

/**
 * Récupère l'organization_id de l'utilisateur connecté.
 * @returns {string|null} UUID de l'organisation courante
 */
export function getOrgId() {
  const profile = useAuthStore.getState().profile;
  return profile?.organization_id || null;
}

/**
 * Ajoute organization_id à un objet de données pour insertion Supabase.
 * @param {Object} data - Données à enrichir
 * @returns {Object} Données avec organization_id ajouté
 */
export function withOrgId(data) {
  const orgId = getOrgId();
  if (!orgId) return data;
  return { ...data, organization_id: orgId };
}

/**
 * Ajoute organization_id à chaque élément d'un tableau pour insertion batch.
 * @param {Array<Object>} items - Tableau de données
 * @returns {Array<Object>} Tableau enrichi
 */
export function withOrgIdArray(items) {
  const orgId = getOrgId();
  if (!orgId) return items;
  return items.map(item => ({ ...item, organization_id: orgId }));
}
