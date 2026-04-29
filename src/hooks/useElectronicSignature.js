/**
 * ====================================================================
 * HOOK: useElectronicSignature
 * ====================================================================
 * Hook React pour gérer les signatures électroniques conformes eIDAS
 * Fonctionnalités:
 * - Capture de signature (canvas)
 * - Génération de certificat eIDAS (AES)
 * - Upload sécurisé vers Supabase Storage
 * - Enregistrement en base de données
 * ====================================================================
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  generateSHA256Hash,
  generateImageHash,
  collectBrowserMetadata,
  getGeolocation,
  generateSignatureCertificate,
  validateSignatureCanvas,
  canvasToBlob,
  resizeCanvas,
  generateSignatureFileName,
  CONSENT_TEXT,
} from '../lib/signature/signatureUtils';

/**
 * Hook pour gérer les signatures électroniques
 * @param {Object} options - Options de configuration
 * @param {string} options.documentType - Type de document ('intervention', 'cerfa', etc.)
 * @param {string} options.documentId - ID du document à signer
 * @param {Object} options.documentContent - Contenu du document (pour hash)
 * @param {boolean} options.requestGeolocation - Demander la géolocalisation (défaut: false)
 * @param {function} options.onSuccess - Callback en cas de succès
 * @param {function} options.onError - Callback en cas d'erreur
 * @returns {Object} Fonctions et état du hook
 */
export function useElectronicSignature({
  documentType,
  documentId,
  documentContent,
  requestGeolocation = false,
  onSuccess,
  onError,
} = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);

  /**
   * Sauvegarde une signature électronique
   * @param {HTMLCanvasElement} canvas - Canvas contenant la signature
   * @param {Object} signerInfo - Informations du signataire
   * @returns {Promise<Object>} Données de la signature enregistrée
   */
  const saveSignature = useCallback(
    async (canvas, signerInfo) => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Validation du consentement RGPD
        if (!consentGiven) {
          throw new Error('Le consentement RGPD est obligatoire pour signer électroniquement');
        }

        // 2. Validation du canvas
        if (!validateSignatureCanvas(canvas)) {
          throw new Error('Veuillez dessiner votre signature avant de valider');
        }

        // 3. Récupération de l'utilisateur connecté
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error('Vous devez être connecté pour signer');
        }

        // 4. Récupération du profil utilisateur
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw new Error('Impossible de récupérer les informations du profil');
        }

        // 5. Génération du hash du document
        let documentHash;
        if (typeof documentContent === 'string') {
          documentHash = await generateSHA256Hash(documentContent);
        } else if (typeof documentContent === 'object') {
          documentHash = await generateSHA256Hash(JSON.stringify(documentContent));
        } else {
          throw new Error('Le contenu du document est invalide');
        }

        // 6. Conversion canvas → Blob
        const originalBlob = await canvasToBlob(canvas);

        // 7. Redimensionnement (optimisation)
        const resizedCanvas = resizeCanvas(canvas, 800, 400);
        const signatureBlob = await canvasToBlob(resizedCanvas);

        // 8. Génération du hash de la signature
        const signatureImageHash = await generateImageHash(signatureBlob);

        // 9. Collecte des métadonnées
        const metadata = collectBrowserMetadata();

        // 10. Géolocalisation (si demandée)
        let geolocation = null;
        if (requestGeolocation) {
          geolocation = await getGeolocation();
        }

        // 11. Génération du certificat eIDAS
        const certificate = generateSignatureCertificate({
          documentHash,
          signatureImageHash,
          signerInfo: {
            userId: user.id,
            name: signerInfo?.name || profile.full_name,
            email: signerInfo?.email || profile.email,
            role: signerInfo?.role || profile.role,
            documentType,
            documentId,
            signatureContext: signerInfo?.context || {},
            consentText: CONSENT_TEXT.FR,
          },
          metadata,
          geolocation,
        });

        // 12. Upload de l'image de signature vers Storage
        const fileName = generateSignatureFileName(user.id, documentType, documentId);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('signature-files')
          .upload(fileName, signatureBlob, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Échec de l'upload: ${uploadError.message}`);
        }

        // 13. Génération du hash du certificat final
        const certificateHash = await generateSHA256Hash(certificate._rawCertificate);
        const finalCertificate = {
          ...certificate,
          integrity: {
            ...certificate.integrity,
            certificateHash,
          },
        };
        delete finalCertificate._rawCertificate;

        // 14. Enregistrement dans la table electronic_signatures
        const { data: signatureRecord, error: dbError } = await supabase
          .from('electronic_signatures')
          .insert({
            user_id: user.id,
            signer_name: signerInfo?.name || profile.full_name,
            signer_email: signerInfo?.email || profile.email,
            signer_role: signerInfo?.role || profile.role,
            document_type: documentType,
            document_id: documentId,
            document_hash: documentHash,
            signature_image_hash: signatureImageHash,
            signature_image_url: uploadData.path,
            signature_certificate: finalCertificate,
            metadata,
            signature_context: signerInfo?.context || {},
            consent_given: true,
            consent_text: CONSENT_TEXT.FR,
            signature_level: 'AES',
            is_valid: true,
          })
          .select()
          .single();

        if (dbError) {
          // En cas d'erreur DB, supprimer l'image uploadée
          await supabase.storage.from('signature-files').remove([fileName]);
          throw new Error(`Échec de l'enregistrement: ${dbError.message}`);
        }

        // 15. Succès !
        const result = {
          signatureId: signatureRecord.id,
          signedAt: signatureRecord.signed_at,
          certificateHash,
          imageUrl: uploadData.path,
        };

        setSignatureData(result);
        setIsLoading(false);

        // Callback de succès
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (err) {
        console.error('❌ Erreur signature électronique:', err);
        setError(err.message);
        setIsLoading(false);

        // Callback d'erreur
        if (onError) {
          onError(err);
        }

        throw err;
      }
    },
    [
      documentType,
      documentId,
      documentContent,
      requestGeolocation,
      consentGiven,
      onSuccess,
      onError,
    ]
  );

  /**
   * Récupère une signature par son ID
   * @param {string} signatureId - ID de la signature
   * @returns {Promise<Object>} Données de la signature
   */
  const getSignature = useCallback(async (signatureId) => {
    try {
      const { data, error } = await supabase
        .from('electronic_signatures')
        .select('*')
        .eq('id', signatureId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ Erreur récupération signature:', err);
      throw err;
    }
  }, []);

  /**
   * Récupère l'URL signée d'une image de signature
   * @param {string} imagePath - Chemin de l'image dans Storage
   * @returns {Promise<string>} URL signée (valide 1h)
   */
  const getSignatureImageUrl = useCallback(async (imagePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('signature-files')
        .createSignedUrl(imagePath, 3600); // 1 heure

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('❌ Erreur génération URL signée:', err);
      throw err;
    }
  }, []);

  /**
   * Vérifie si un document est signé
   * @param {string} docType - Type de document
   * @param {string} docId - ID du document
   * @returns {Promise<boolean>} true si signé
   */
  const isDocumentSigned = useCallback(async (docType, docId) => {
    try {
      const { data, error } = await supabase.rpc('is_document_signed', {
        p_document_type: docType,
        p_document_id: docId,
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ Erreur vérification signature:', err);
      return false;
    }
  }, []);

  /**
   * Récupère la dernière signature d'un document
   * @param {string} docType - Type de document
   * @param {string} docId - ID du document
   * @returns {Promise<Object|null>} Signature ou null
   */
  const getLatestSignature = useCallback(async (docType, docId) => {
    try {
      const { data, error } = await supabase.rpc('get_latest_signature', {
        p_document_type: docType,
        p_document_id: docId,
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (err) {
      console.error('❌ Erreur récupération dernière signature:', err);
      return null;
    }
  }, []);

  /**
   * Révoquer une signature (RGPD - Droit à l'effacement)
   * @param {string} signatureId - ID de la signature
   * @param {string} reason - Raison de la révocation
   * @returns {Promise<Object>} Signature révoquée
   */
  const revokeSignature = useCallback(async (signatureId, reason = 'Demande utilisateur') => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('electronic_signatures')
        .update({
          is_valid: false,
          revoked_at: new Date().toISOString(),
          revocation_reason: reason,
          revoked_by: user?.id,
        })
        .eq('id', signatureId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ Erreur révocation signature:', err);
      throw err;
    }
  }, []);

  /**
   * Réinitialise l'état du hook
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setSignatureData(null);
    setConsentGiven(false);
  }, []);

  return {
    // État
    isLoading,
    error,
    signatureData,
    consentGiven,

    // Actions
    saveSignature,
    getSignature,
    getSignatureImageUrl,
    isDocumentSigned,
    getLatestSignature,
    revokeSignature,
    setConsentGiven,
    reset,

    // Utilitaires
    CONSENT_TEXT: CONSENT_TEXT.FR,
  };
}

export default useElectronicSignature;
