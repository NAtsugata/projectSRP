// src/hooks/useSecureSignature.js
// Hook personnalisé pour gérer les signatures électroniques conformes eIDAS & RGPD

import { useState, useCallback } from 'react';
import {
  createElectronicSignature,
  verifyElectronicSignature,
  revokeElectronicSignature,
  deleteElectronicSignature,
  getUserSignatures,
  getSignatureImageUrl
} from '../services/electronicSignatureService';
import { useAuthStore } from '../store/authStore';
import logger from '../utils/logger';

/**
 * Hook pour gérer les signatures électroniques
 * @param {Object} options - Options du hook
 * @returns {Object} Fonctions et état de gestion des signatures
 */
export const useSecureSignature = (options = {}) => {
  const { user, profile } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [currentSignature, setCurrentSignature] = useState(null);

  /**
   * Créer une signature électronique
   */
  const createSignature = useCallback(async ({
    documentType,
    documentId,
    documentData,
    signatureImageBase64,
    consentGiven,
    consentText,
    signatureContext = {}
  }) => {
    if (!user || !profile) {
      setError('Utilisateur non authentifié');
      return { success: false, error: 'Utilisateur non authentifié' };
    }

    try {
      setIsCreating(true);
      setError(null);

      logger.log('[useSecureSignature] Création signature pour:', documentType, documentId);

      const result = await createElectronicSignature({
        userId: user.id,
        signerName: profile.full_name || user.email,
        signerEmail: user.email,
        signerRole: profile.is_admin ? 'admin' : 'user',
        documentType,
        documentId,
        documentData,
        signatureImageBase64,
        consentGiven,
        consentText,
        signatureContext
      });

      if (result.success) {
        setCurrentSignature(result.signature);
        logger.log('[useSecureSignature] ✅ Signature créée:', result.signature.id);
      } else {
        setError(result.error);
      }

      return result;

    } catch (err) {
      const errorMsg = err.message || 'Erreur création signature';
      setError(errorMsg);
      logger.error('[useSecureSignature] Erreur:', err);
      return { success: false, error: errorMsg };

    } finally {
      setIsCreating(false);
    }
  }, [user, profile]);

  /**
   * Vérifier l'intégrité d'une signature
   */
  const verifySignature = useCallback(async (signatureId, currentDocumentData) => {
    try {
      setIsVerifying(true);
      setError(null);

      logger.log('[useSecureSignature] Vérification signature:', signatureId);

      const result = await verifyElectronicSignature(signatureId, currentDocumentData);

      if (!result.valid) {
        setError(result.reason);
      }

      return result;

    } catch (err) {
      const errorMsg = err.message || 'Erreur vérification signature';
      setError(errorMsg);
      logger.error('[useSecureSignature] Erreur:', err);
      return { valid: false, error: errorMsg };

    } finally {
      setIsVerifying(false);
    }
  }, []);

  /**
   * Révoquer une signature
   */
  const revokeSignature = useCallback(async (signatureId, reason) => {
    if (!user) {
      return { success: false, error: 'Utilisateur non authentifié' };
    }

    try {
      setError(null);
      logger.log('[useSecureSignature] Révocation signature:', signatureId);

      const result = await revokeElectronicSignature(signatureId, reason, user.id);

      if (result.success && currentSignature?.id === signatureId) {
        setCurrentSignature(null);
      }

      return result;

    } catch (err) {
      const errorMsg = err.message || 'Erreur révocation signature';
      setError(errorMsg);
      logger.error('[useSecureSignature] Erreur:', err);
      return { success: false, error: errorMsg };
    }
  }, [user, currentSignature]);

  /**
   * Supprimer définitivement une signature (RGPD - Droit à l'effacement)
   */
  const deleteSignature = useCallback(async (signatureId) => {
    if (!user) {
      return { success: false, error: 'Utilisateur non authentifié' };
    }

    try {
      setError(null);
      logger.log('[useSecureSignature] Suppression signature:', signatureId);

      const result = await deleteElectronicSignature(signatureId, user.id);

      if (result.success && currentSignature?.id === signatureId) {
        setCurrentSignature(null);
      }

      return result;

    } catch (err) {
      const errorMsg = err.message || 'Erreur suppression signature';
      setError(errorMsg);
      logger.error('[useSecureSignature] Erreur:', err);
      return { success: false, error: errorMsg };
    }
  }, [user, currentSignature]);

  /**
   * Récupérer toutes les signatures de l'utilisateur (RGPD - Droit d'accès)
   */
  const loadUserSignatures = useCallback(async () => {
    if (!user) {
      return { success: false, signatures: [], error: 'Utilisateur non authentifié' };
    }

    try {
      setError(null);
      logger.log('[useSecureSignature] Chargement signatures utilisateur');

      const result = await getUserSignatures(user.id);
      return result;

    } catch (err) {
      const errorMsg = err.message || 'Erreur chargement signatures';
      setError(errorMsg);
      logger.error('[useSecureSignature] Erreur:', err);
      return { success: false, signatures: [], error: errorMsg };
    }
  }, [user]);

  /**
   * Obtenir l'URL signée de l'image de signature
   */
  const getSignedImageUrl = useCallback(async (signaturePath) => {
    try {
      const url = await getSignatureImageUrl(signaturePath);
      return url;
    } catch (err) {
      logger.error('[useSecureSignature] Erreur URL image:', err);
      return null;
    }
  }, []);

  /**
   * Réinitialiser l'état
   */
  const reset = useCallback(() => {
    setCurrentSignature(null);
    setError(null);
  }, []);

  return {
    // État
    isCreating,
    isVerifying,
    error,
    currentSignature,

    // Actions
    createSignature,
    verifySignature,
    revokeSignature,
    deleteSignature,
    loadUserSignatures,
    getSignedImageUrl,
    reset,

    // Helpers
    isAuthenticated: !!user,
    userInfo: user ? {
      id: user.id,
      email: user.email,
      name: profile?.full_name,
      isAdmin: profile?.is_admin
    } : null
  };
};

export default useSecureSignature;
