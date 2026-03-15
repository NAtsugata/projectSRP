// src/components/SecureSignaturePad.jsx
// Composant de signature conforme eIDAS & RGPD
// Inclut consentement explicite et collecte métadonnées

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createElectronicSignature } from '../services/electronicSignatureService';
import { useAuthStore } from '../store/authStore';
import logger from '../utils/logger';
import './SecureSignaturePad.css';

/**
 * Composant de signature électronique conforme eIDAS et RGPD
 *
 * @param {Object} props
 * @param {Function} props.onSave - Callback avec signature créée
 * @param {Function} props.onCancel - Callback d'annulation
 * @param {string} props.documentType - Type de document ('intervention', 'cerfa', etc.)
 * @param {string} props.documentId - ID du document
 * @param {Object} props.documentData - Données complètes du document (pour hash)
 * @param {Object} props.signatureContext - Contexte métier additionnel
 * @param {string} props.initialSignature - Signature existante (optionnel)
 */
const SecureSignaturePad = ({
  onSave,
  onCancel,
  documentType,
  documentId,
  documentData,
  signatureContext = {},
  initialSignature = null
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [step, setStep] = useState('consent'); // 'consent' | 'sign' | 'processing'

  // RGPD - Consentement
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentText] = useState(
    `Je consens à ce que ma signature électronique soit collectée et traitée conformément au RGPD (UE) 2016/679 et au règlement eIDAS (UE) 910/2014.\n\n` +
    `Les données collectées incluent :\n` +
    `- Mon nom, email et rôle\n` +
    `- L'image de ma signature manuscrite\n` +
    `- L'horodatage de la signature\n` +
    `- Les métadonnées techniques (navigateur, appareil, localisation optionnelle)\n` +
    `- Le hash cryptographique du document signé\n\n` +
    `Ces données sont utilisées pour :\n` +
    `- Garantir l'authenticité et l'intégrité du document signé\n` +
    `- Assurer la non-répudiation de la signature\n` +
    `- Se conformer aux obligations légales\n\n` +
    `Vous disposez d'un droit d'accès, de rectification et de suppression de vos données (droit à l'effacement).`
  );

  // Geolocation consent
  const [geolocationConsent, setGeolocationConsent] = useState(false);

  // Auth
  const { user, profile } = useAuthStore();

  // Initialiser le canvas
  useEffect(() => {
    if (step !== 'sign') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Configuration responsive
    const isMobile = window.innerWidth < 768;
    canvas.width = Math.min(window.innerWidth - 80, 600);
    canvas.height = isMobile ? 300 : 200;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Charger signature existante si présente
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [step, initialSignature]);

  // Obtenir les coordonnées (souris ou tactile)
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  // Commencer à dessiner
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  }, [getCoordinates]);

  // Dessiner
  const draw = useCallback((e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCoordinates]);

  // Arrêter de dessiner
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  }, [isDrawing]);

  // Effacer la signature
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  // Accepter le consentement et passer à l'étape signature
  const handleConsentAccept = () => {
    if (!consentGiven) {
      alert('Vous devez accepter le consentement pour continuer');
      return;
    }
    setStep('sign');
  };

  // Valider et sauvegarder la signature
  const handleValidate = async () => {
    if (!hasSignature) {
      alert('Veuillez dessiner votre signature');
      return;
    }

    if (!user || !profile) {
      alert('Utilisateur non authentifié');
      return;
    }

    try {
      setStep('processing');

      // Obtenir la signature en base64
      const canvas = canvasRef.current;
      const signatureImageBase64 = canvas.toDataURL('image/png');

      logger.log('[SecureSignature] Création signature électronique...');

      // Créer la signature électronique conforme eIDAS
      const result = await createElectronicSignature({
        // Signataire
        userId: user.id,
        signerName: profile.full_name || user.email,
        signerEmail: user.email,
        signerRole: profile.is_admin ? 'admin' : 'user',

        // Document
        documentType,
        documentId,
        documentData,

        // Signature
        signatureImageBase64,

        // Consentement RGPD
        consentGiven: true,
        consentText,

        // Contexte
        signatureContext: {
          ...signatureContext,
          geolocationConsentGiven: geolocationConsent
        }
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.log('[SecureSignature] ✅ Signature créée:', result.signature.id);

      // Callback avec la signature complète
      if (onSave) {
        onSave({
          signature: result.signature,
          certificate: result.certificate,
          documentHash: result.documentHash
        });
      }

    } catch (error) {
      logger.error('[SecureSignature] Erreur:', error);
      alert(`Erreur lors de la création de la signature: ${error.message}`);
      setStep('sign');
    }
  };

  // Prévenir scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="secure-signature-overlay">
      <div className="secure-signature-modal">
        {/* ÉTAPE 1: CONSENTEMENT RGPD */}
        {step === 'consent' && (
          <>
            <div className="secure-signature-header">
              <h2>🔐 Signature Électronique Sécurisée</h2>
              <p className="secure-signature-subtitle">
                Conforme eIDAS (Règlement UE 910/2014) et RGPD (Règlement UE 2016/679)
              </p>
            </div>

            <div className="secure-signature-content">
              <div className="consent-section">
                <h3>📋 Consentement RGPD</h3>
                <div className="consent-text">
                  {consentText.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>

                <div className="consent-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                    />
                    <strong>J'accepte le traitement de mes données de signature</strong>
                  </label>
                </div>

                <div className="consent-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={geolocationConsent}
                      onChange={(e) => setGeolocationConsent(e.target.checked)}
                    />
                    J'accepte que ma position géographique soit collectée (optionnel)
                  </label>
                </div>

                <div className="consent-info">
                  <p>
                    <strong>ℹ️ Vos droits RGPD :</strong>
                  </p>
                  <ul>
                    <li>Droit d'accès à vos signatures</li>
                    <li>Droit de rectification</li>
                    <li>Droit à l'effacement (suppression)</li>
                    <li>Droit de portabilité</li>
                    <li>Droit d'opposition au traitement</li>
                  </ul>
                  <p>
                    Pour exercer vos droits, contactez : <strong>rgpd@votre-entreprise.fr</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="secure-signature-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onCancel}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConsentAccept}
                disabled={!consentGiven}
              >
                Continuer vers la signature →
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 2: SIGNATURE */}
        {step === 'sign' && (
          <>
            <div className="secure-signature-header">
              <h2>✍️ Votre Signature</h2>
              <p className="secure-signature-subtitle">
                Dessinez votre signature dans la zone ci-dessous
              </p>
            </div>

            <div className="secure-signature-content">
              <canvas
                ref={canvasRef}
                className="signature-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  border: '2px solid #2196F3',
                  borderRadius: '8px',
                  touchAction: 'none',
                  cursor: 'crosshair',
                  background: '#ffffff'
                }}
              />

              <div className="signature-info">
                <p>
                  🔒 <strong>Sécurité :</strong> Votre signature sera chiffrée et horodatée
                </p>
                <p>
                  ✅ <strong>Validité :</strong> Signature électronique avancée (AES) conforme eIDAS
                </p>
              </div>
            </div>

            <div className="secure-signature-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStep('consent')}
              >
                ← Retour
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                Effacer
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleValidate}
                disabled={!hasSignature}
              >
                ✓ Valider la signature
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 3: TRAITEMENT */}
        {step === 'processing' && (
          <div className="secure-signature-processing">
            <div className="spinner"></div>
            <h3>Création de la signature électronique...</h3>
            <p>Génération du certificat eIDAS et horodatage</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SecureSignaturePad;
