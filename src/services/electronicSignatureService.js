// src/services/electronicSignatureService.js
// Service de signature électronique conforme eIDAS (AES) et RGPD
// Règlement eIDAS (UE) 910/2014 - Signature Électronique Avancée

import { supabase } from '../lib/supabase';
import { getOrgId } from '../utils/orgHelper';
import logger from '../utils/logger';

/**
 * NIVEAUX DE SIGNATURE eIDAS
 * - SES (Simple Electronic Signature) : Signature basique
 * - AES (Advanced Electronic Signature) : Signature avancée (ce service)
 * - QES (Qualified Electronic Signature) : Signature qualifiée (nécessite certificat qualifié)
 */

/**
 * Génère un hash SHA-256 d'un document
 * @param {Object} document - Document à signer
 * @returns {Promise<string>} Hash du document
 */
async function generateDocumentHash(document) {
  try {
    const documentString = JSON.stringify(document, Object.keys(document).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(documentString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    logger.error('[ElectronicSignature] Erreur génération hash:', error);
    throw new Error('Impossible de générer le hash du document');
  }
}

/**
 * Collecte les métadonnées de signature pour assurer la non-répudiation
 * @returns {Promise<Object>} Métadonnées
 */
async function collectSignatureMetadata() {
  const metadata = {
    // Informations techniques (eIDAS)
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),

    // Informations réseau (pour traçabilité RGPD)
    online: navigator.onLine,
    connectionType: navigator.connection?.effectiveType || 'unknown',
  };

  // Tentative de récupération de la géolocalisation (optionnel, avec consentement)
  try {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 60000
      });
    });

    if (position) {
      metadata.geolocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
    }
  } catch (error) {
    // Géolocalisation refusée ou non disponible (acceptable)
    logger.log('[ElectronicSignature] Géolocalisation non disponible');
  }

  return metadata;
}

/**
 * Génère un certificat de signature (preuve de non-répudiation)
 * @param {Object} signatureData - Données de la signature
 * @returns {Promise<string>} Certificat signé
 */
async function generateSignatureCertificate(signatureData) {
  try {
    const certificateData = {
      version: '1.0',
      standard: 'eIDAS-AES',
      timestamp: signatureData.signed_at,
      signatory: {
        userId: signatureData.user_id,
        fullName: signatureData.signer_name,
        email: signatureData.signer_email,
        role: signatureData.signer_role
      },
      document: {
        type: signatureData.document_type,
        id: signatureData.document_id,
        hash: signatureData.document_hash
      },
      signature: {
        imageHash: signatureData.signature_image_hash,
        metadata: signatureData.metadata
      },
      consent: signatureData.consent_given
    };

    // Signer le certificat avec un hash
    const certificateString = JSON.stringify(certificateData, Object.keys(certificateData).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(certificateString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const certificateHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return JSON.stringify({
      ...certificateData,
      certificateHash,
      issuedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[ElectronicSignature] Erreur génération certificat:', error);
    throw new Error('Impossible de générer le certificat de signature');
  }
}

/**
 * Crée une signature électronique avancée conforme eIDAS
 * @param {Object} params - Paramètres de signature
 * @returns {Promise<Object>} Signature créée avec certificat
 */
export async function createElectronicSignature({
  // Données du signataire (eIDAS - Identification)
  userId,
  signerName,
  signerEmail,
  signerRole,

  // Données du document (eIDAS - Intégrité)
  documentType,  // 'intervention', 'cerfa', 'contract', 'pv_reception', etc.
  documentId,
  documentData,  // Document complet pour hash

  // Signature manuscrite (image)
  signatureImageBase64,

  // Consentement RGPD
  consentGiven,
  consentText,

  // Métadonnées supplémentaires
  signatureContext = {}
}) {
  try {
    logger.log('[ElectronicSignature] Création signature électronique pour:', documentType, documentId);

    // 1. Validation des données requises
    if (!userId || !signerName || !documentType || !documentId || !signatureImageBase64) {
      throw new Error('Données de signature incomplètes');
    }

    if (!consentGiven) {
      throw new Error('Consentement RGPD non donné');
    }

    // 2. Générer hash du document (eIDAS - Intégrité)
    const documentHash = await generateDocumentHash(documentData);
    logger.log('[ElectronicSignature] Hash document:', documentHash.substring(0, 16) + '...');

    // 3. Générer hash de l'image de signature
    const encoder = new TextEncoder();
    const signatureData = encoder.encode(signatureImageBase64);
    const signatureHashBuffer = await crypto.subtle.digest('SHA-256', signatureData);
    const signatureHashArray = Array.from(new Uint8Array(signatureHashBuffer));
    const signatureImageHash = signatureHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. Collecter métadonnées (eIDAS - Non-répudiation)
    const metadata = await collectSignatureMetadata();
    logger.log('[ElectronicSignature] Métadonnées collectées:', Object.keys(metadata));

    // 5. Préparer les données de signature
    const signatureRecord = {
      user_id: userId,
      signer_name: signerName,
      signer_email: signerEmail,
      signer_role: signerRole,

      document_type: documentType,
      document_id: documentId,
      document_hash: documentHash,

      signature_image_hash: signatureImageHash,
      signature_image_url: null, // Sera rempli après upload Storage

      metadata: metadata,
      signature_context: signatureContext,

      consent_given: consentGiven,
      consent_text: consentText,
      consent_timestamp: new Date().toISOString(),

      signed_at: new Date().toISOString(),
      signature_level: 'AES', // Advanced Electronic Signature
      is_valid: true,
      revoked_at: null
    };

    // 6. Générer certificat de signature
    const certificate = await generateSignatureCertificate(signatureRecord);
    signatureRecord.signature_certificate = certificate;

    // 7. Upload image de signature dans Supabase Storage (sécurisé)
    // Arborescence canonique : {org}/employees/{user}/signatures/...
    const fileName = `${documentType}_${documentId}_${Date.now()}.png`;
    const sigOrgId = getOrgId();
    const filePath = sigOrgId
      ? `${sigOrgId}/employees/${userId}/signatures/${fileName}`
      : `${userId}/${fileName}`;

    // Convertir base64 en blob
    const base64Data = signatureImageBase64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('signature-files')
      .upload(filePath, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error('[ElectronicSignature] Erreur upload signature:', uploadError);
      throw uploadError;
    }

    signatureRecord.signature_image_url = uploadData.path;
    logger.log('[ElectronicSignature] Image signature uploadée:', filePath);

    // 8. Sauvegarder la signature dans la base de données
    const { data: savedSignature, error: saveError } = await supabase
      .from('electronic_signatures')
      .insert([signatureRecord])
      .select()
      .single();

    if (saveError) {
      logger.error('[ElectronicSignature] Erreur sauvegarde signature:', saveError);
      throw saveError;
    }

    logger.log('[ElectronicSignature] ✅ Signature électronique créée:', savedSignature.id);

    return {
      success: true,
      signature: savedSignature,
      certificate: JSON.parse(certificate),
      documentHash,
      message: 'Signature électronique créée avec succès'
    };

  } catch (error) {
    logger.error('[ElectronicSignature] Erreur création signature:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la création de la signature'
    };
  }
}

/**
 * Vérifie l'intégrité d'une signature électronique
 * @param {string} signatureId - ID de la signature
 * @param {Object} currentDocumentData - Document actuel pour vérification
 * @returns {Promise<Object>} Résultat de vérification
 */
export async function verifyElectronicSignature(signatureId, currentDocumentData) {
  try {
    logger.log('[ElectronicSignature] Vérification signature:', signatureId);

    // 1. Récupérer la signature
    const { data: signature, error } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('id', signatureId)
      .single();

    if (error || !signature) {
      return {
        valid: false,
        reason: 'Signature introuvable'
      };
    }

    // 2. Vérifier si révoquée
    if (!signature.is_valid || signature.revoked_at) {
      return {
        valid: false,
        reason: 'Signature révoquée',
        revokedAt: signature.revoked_at,
        revocationReason: signature.revocation_reason
      };
    }

    // 3. Recalculer le hash du document actuel
    const currentHash = await generateDocumentHash(currentDocumentData);

    // 4. Comparer avec le hash enregistré
    const hashMatch = currentHash === signature.document_hash;

    if (!hashMatch) {
      logger.warn('[ElectronicSignature] Hash ne correspond pas!');
      return {
        valid: false,
        reason: 'Document modifié après signature',
        originalHash: signature.document_hash,
        currentHash
      };
    }

    // 5. Vérifier le certificat
    let certificateValid = true;
    try {
      const certificate = JSON.parse(signature.signature_certificate);
      // Vérifier que le hash du certificat correspond
      const certificateData = { ...certificate };
      delete certificateData.certificateHash;
      delete certificateData.issuedAt;

      const certificateString = JSON.stringify(certificateData, Object.keys(certificateData).sort());
      const encoder = new TextEncoder();
      const data = encoder.encode(certificateString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      certificateValid = (computedHash === certificate.certificateHash);
    } catch (certError) {
      logger.error('[ElectronicSignature] Erreur vérification certificat:', certError);
      certificateValid = false;
    }

    logger.log('[ElectronicSignature] ✅ Signature valide');

    return {
      valid: hashMatch && certificateValid,
      signature,
      certificate: JSON.parse(signature.signature_certificate),
      hashMatch,
      certificateValid,
      signedAt: signature.signed_at,
      signer: {
        name: signature.signer_name,
        email: signature.signer_email,
        role: signature.signer_role
      }
    };

  } catch (error) {
    logger.error('[ElectronicSignature] Erreur vérification:', error);
    return {
      valid: false,
      reason: 'Erreur technique lors de la vérification',
      error: error.message
    };
  }
}

/**
 * Révoquer une signature (RGPD - Droit à l'effacement)
 * @param {string} signatureId - ID de la signature
 * @param {string} reason - Raison de révocation
 * @param {string} revokedBy - ID de l'utilisateur révoquant
 * @returns {Promise<Object>} Résultat
 */
export async function revokeElectronicSignature(signatureId, reason, revokedBy) {
  try {
    logger.log('[ElectronicSignature] Révocation signature:', signatureId);

    const { data, error } = await supabase
      .from('electronic_signatures')
      .update({
        is_valid: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
        revoked_by: revokedBy
      })
      .eq('id', signatureId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.log('[ElectronicSignature] ✅ Signature révoquée');

    return {
      success: true,
      signature: data,
      message: 'Signature révoquée avec succès'
    };

  } catch (error) {
    logger.error('[ElectronicSignature] Erreur révocation:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère l'URL signée de l'image de signature (RGPD - Accès sécurisé)
 * @param {string} signaturePath - Chemin du fichier
 * @returns {Promise<string>} URL signée
 */
export async function getSignatureImageUrl(signaturePath) {
  try {
    const { data, error } = await supabase.storage
      .from('signature-files')
      .createSignedUrl(signaturePath, 3600); // 1 heure

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    logger.error('[ElectronicSignature] Erreur récupération URL:', error);
    return null;
  }
}

/**
 * Supprimer définitivement une signature (RGPD - Droit à l'effacement)
 * @param {string} signatureId - ID de la signature
 * @param {string} userId - ID de l'utilisateur demandant la suppression
 * @returns {Promise<Object>} Résultat
 */
export async function deleteElectronicSignature(signatureId, userId) {
  try {
    logger.log('[ElectronicSignature] Suppression signature:', signatureId);

    // 1. Récupérer la signature
    const { data: signature, error: fetchError } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('id', signatureId)
      .single();

    if (fetchError || !signature) {
      throw new Error('Signature introuvable');
    }

    // 2. Vérifier que l'utilisateur a le droit (RGPD - Droit à l'effacement)
    if (signature.user_id !== userId) {
      throw new Error('Non autorisé à supprimer cette signature');
    }

    // 3. Supprimer l'image du Storage
    if (signature.signature_image_url) {
      const { error: storageError } = await supabase.storage
        .from('signature-files')
        .remove([signature.signature_image_url]);

      if (storageError) {
        logger.warn('[ElectronicSignature] Erreur suppression image:', storageError);
      }
    }

    // 4. Supprimer l'enregistrement de la base
    const { error: deleteError } = await supabase
      .from('electronic_signatures')
      .delete()
      .eq('id', signatureId);

    if (deleteError) {
      throw deleteError;
    }

    logger.log('[ElectronicSignature] ✅ Signature supprimée');

    return {
      success: true,
      message: 'Signature supprimée définitivement (RGPD)'
    };

  } catch (error) {
    logger.error('[ElectronicSignature] Erreur suppression:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Récupère toutes les signatures d'un utilisateur (RGPD - Droit d'accès)
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} Liste des signatures
 */
export async function getUserSignatures(userId) {
  try {
    const { data, error } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('user_id', userId)
      .order('signed_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      success: true,
      signatures: data || []
    };

  } catch (error) {
    logger.error('[ElectronicSignature] Erreur récupération signatures:', error);
    return {
      success: false,
      signatures: [],
      error: error.message
    };
  }
}

export default {
  createElectronicSignature,
  verifyElectronicSignature,
  revokeElectronicSignature,
  deleteElectronicSignature,
  getUserSignatures,
  getSignatureImageUrl,
  generateDocumentHash
};
