/**
 * ====================================================================
 * COMPOSANT: SignatureViewer
 * ====================================================================
 * Affiche une signature électronique avec son certificat eIDAS
 * Fonctionnalités:
 * - Affichage de l'image de signature
 * - Détails du certificat eIDAS
 * - Vérification de validité
 * - Informations du signataire
 * ====================================================================
 */

import React, { useState, useEffect } from 'react';
import useElectronicSignature from '../../hooks/useElectronicSignature';
import { formatSignatureDate } from '../../lib/signature/signatureUtils';
import './SignatureViewer.css';

const SignatureViewer = ({
  signatureId,
  signatureData,
  showCertificate = true,
  showMetadata = false,
  compact = false,
}) => {
  const [signature, setSignature] = useState(signatureData || null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(!signatureData);
  const [error, setError] = useState(null);
  const [showFullCertificate, setShowFullCertificate] = useState(false);

  const { getSignature, getSignatureImageUrl } = useElectronicSignature();

  // Charger la signature si seulement l'ID est fourni
  useEffect(() => {
    if (signatureData) {
      setSignature(signatureData);
      setLoading(false);
      return;
    }

    if (signatureId) {
      loadSignature();
    }
  }, [signatureId, signatureData]);

  // Charger l'URL de l'image
  useEffect(() => {
    if (signature?.signature_image_url) {
      loadImageUrl(signature.signature_image_url);
    }
  }, [signature]);

  const loadSignature = async () => {
    try {
      setLoading(true);
      const data = await getSignature(signatureId);
      setSignature(data);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement signature:', err);
      setError('Impossible de charger la signature');
    } finally {
      setLoading(false);
    }
  };

  const loadImageUrl = async (imagePath) => {
    try {
      const url = await getSignatureImageUrl(imagePath);
      setImageUrl(url);
    } catch (err) {
      console.error('Erreur chargement image:', err);
    }
  };

  if (loading) {
    return (
      <div className="signature-viewer loading">
        <div className="spinner-small" />
        <p>Chargement de la signature...</p>
      </div>
    );
  }

  if (error || !signature) {
    return (
      <div className="signature-viewer error">
        <p>❌ {error || 'Signature non disponible'}</p>
      </div>
    );
  }

  const certificate = signature.signature_certificate || {};
  const isValid = signature.is_valid;
  const isRevoked = !isValid && signature.revoked_at;

  return (
    <div className={`signature-viewer ${compact ? 'compact' : ''} ${!isValid ? 'revoked' : ''}`}>
      {/* Statut de validité */}
      <div className={`signature-status ${isValid ? 'valid' : 'invalid'}`}>
        {isValid ? (
          <>
            <span className="status-icon">✅</span>
            <span className="status-text">Signature valide</span>
          </>
        ) : (
          <>
            <span className="status-icon">⚠️</span>
            <span className="status-text">
              Signature {isRevoked ? 'révoquée' : 'invalide'}
            </span>
          </>
        )}
      </div>

      {/* Image de signature */}
      {imageUrl && (
        <div className="signature-image-container">
          <img src={imageUrl} alt="Signature électronique" className="signature-image" />
        </div>
      )}

      {/* Informations du signataire */}
      <div className="signature-info">
        <h4>📝 Informations du signataire</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Nom:</span>
            <span className="info-value">{signature.signer_name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email:</span>
            <span className="info-value">{signature.signer_email}</span>
          </div>
          {signature.signer_role && (
            <div className="info-item">
              <span className="info-label">Rôle:</span>
              <span className="info-value">{signature.signer_role}</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">Date de signature:</span>
            <span className="info-value">{formatSignatureDate(signature.signed_at)}</span>
          </div>
        </div>
      </div>

      {/* Document signé */}
      <div className="signature-document">
        <h4>📄 Document</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Type:</span>
            <span className="info-value">{signature.document_type}</span>
          </div>
          <div className="info-item">
            <span className="info-label">ID:</span>
            <span className="info-value code">{signature.document_id}</span>
          </div>
        </div>
      </div>

      {/* Certificat eIDAS */}
      {showCertificate && certificate && (
        <div className="signature-certificate">
          <h4>🔐 Certificat eIDAS</h4>
          <div className="certificate-summary">
            <div className="info-item">
              <span className="info-label">Standard:</span>
              <span className="info-value badge">{certificate.standard || 'eIDAS-AES'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Niveau:</span>
              <span className="info-value badge">
                {certificate.signatureLevel || signature.signature_level}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Conformité:</span>
              <span className="info-value">
                {certificate.compliance?.eIDAS || 'EU 910/2014'}
              </span>
            </div>
          </div>

          {/* Hash d'intégrité */}
          <div className="certificate-integrity">
            <h5>🔒 Intégrité</h5>
            <div className="hash-item">
              <span className="hash-label">Hash du document:</span>
              <code className="hash-value">{signature.document_hash.substring(0, 16)}...</code>
            </div>
            <div className="hash-item">
              <span className="hash-label">Hash de la signature:</span>
              <code className="hash-value">
                {signature.signature_image_hash.substring(0, 16)}...
              </code>
            </div>
            {certificate.integrity?.certificateHash && (
              <div className="hash-item">
                <span className="hash-label">Hash du certificat:</span>
                <code className="hash-value">
                  {certificate.integrity.certificateHash.substring(0, 16)}...
                </code>
              </div>
            )}
          </div>

          {/* Bouton pour afficher le certificat complet */}
          <button
            type="button"
            className="btn-toggle-certificate"
            onClick={() => setShowFullCertificate(!showFullCertificate)}
          >
            {showFullCertificate ? '▲ Masquer' : '▼ Afficher'} le certificat complet
          </button>

          {/* Certificat complet (JSON) */}
          {showFullCertificate && (
            <div className="certificate-full">
              <pre>{JSON.stringify(certificate, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Métadonnées techniques */}
      {showMetadata && signature.metadata && (
        <div className="signature-metadata">
          <h4>🖥️ Métadonnées techniques</h4>
          <details>
            <summary>Voir les métadonnées complètes</summary>
            <div className="metadata-content">
              <pre>{JSON.stringify(signature.metadata, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}

      {/* Révocation */}
      {isRevoked && (
        <div className="signature-revocation">
          <h4>⚠️ Révocation</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Date de révocation:</span>
              <span className="info-value">{formatSignatureDate(signature.revoked_at)}</span>
            </div>
            {signature.revocation_reason && (
              <div className="info-item">
                <span className="info-label">Raison:</span>
                <span className="info-value">{signature.revocation_reason}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer eIDAS */}
      <div className="signature-footer">
        <p className="footer-text">
          Cette signature électronique est conforme au Règlement eIDAS (UE) 910/2014 et au RGPD
          (UE) 2016/679
        </p>
      </div>
    </div>
  );
};

export default SignatureViewer;
