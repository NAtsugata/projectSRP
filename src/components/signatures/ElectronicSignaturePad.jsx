/**
 * ====================================================================
 * COMPOSANT: ElectronicSignaturePad
 * ====================================================================
 * Pad de signature électronique conforme eIDAS (AES)
 * Fonctionnalités:
 * - Canvas de signature tactile + souris
 * - Consentement RGPD obligatoire
 * - Validation en temps réel
 * - Responsive (desktop + mobile)
 * ====================================================================
 */

import React, { useRef, useState, useEffect } from 'react';
import useElectronicSignature from '../../hooks/useElectronicSignature';
import { checkBrowserSupport } from '../../lib/signature/signatureUtils';
import './ElectronicSignaturePad.css';

const ElectronicSignaturePad = ({
  documentType,
  documentId,
  documentContent,
  signerInfo = {},
  requestGeolocation = false,
  onSignatureComplete,
  onCancel,
  showConsentText = true,
  disabled = false,
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(null);

  const {
    isLoading,
    error,
    consentGiven,
    setConsentGiven,
    saveSignature,
    CONSENT_TEXT,
  } = useElectronicSignature({
    documentType,
    documentId,
    documentContent,
    requestGeolocation,
    onSuccess: onSignatureComplete,
    onError: (err) => console.error('Erreur signature:', err),
  });

  // Vérifier le support du navigateur au montage
  useEffect(() => {
    const support = checkBrowserSupport();
    setBrowserSupport(support);

    if (!support.canvas) {
      console.error('❌ Votre navigateur ne supporte pas Canvas');
    }
    if (!support.cryptoSubtle) {
      console.error('❌ Votre navigateur ne supporte pas Crypto API');
    }
  }, []);

  // Configuration du canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Ajuster la taille du canvas à son conteneur
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Configuration du style de dessin
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Gestion du dessin (Souris)
  const startDrawing = (e) => {
    if (disabled || isLoading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled || isLoading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Gestion du dessin (Tactile)
  const startDrawingTouch = (e) => {
    if (disabled || isLoading) return;

    e.preventDefault();
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const drawTouch = (e) => {
    if (!isDrawing || disabled || isLoading) return;

    e.preventDefault();
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingTouch = () => {
    setIsDrawing(false);
  };

  // Effacer le canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Validation et sauvegarde
  const handleSubmit = async () => {
    if (!hasDrawn) {
      alert('Veuillez dessiner votre signature avant de valider');
      return;
    }

    if (!consentGiven) {
      alert('Vous devez accepter le consentement RGPD pour signer électroniquement');
      return;
    }

    try {
      await saveSignature(canvasRef.current, signerInfo);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
    }
  };

  // Vérification du support navigateur
  if (browserSupport && (!browserSupport.canvas || !browserSupport.cryptoSubtle)) {
    return (
      <div className="signature-pad-error">
        <h3>❌ Navigateur non compatible</h3>
        <p>
          Votre navigateur ne supporte pas les API nécessaires pour la signature électronique.
        </p>
        <p>Veuillez utiliser un navigateur moderne (Chrome, Firefox, Safari, Edge).</p>
      </div>
    );
  }

  return (
    <div className="electronic-signature-pad">
      <div className="signature-pad-header">
        <h3>✍️ Signature Électronique</h3>
        <p className="signature-standard">
          <strong>Norme:</strong> eIDAS (UE) 910/2014 - Advanced Electronic Signature (AES)
        </p>
      </div>

      {/* Canvas de signature */}
      <div className="signature-canvas-container">
        <canvas
          ref={canvasRef}
          className={`signature-canvas ${disabled || isLoading ? 'disabled' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawingTouch}
          onTouchMove={drawTouch}
          onTouchEnd={stopDrawingTouch}
        />
        {!hasDrawn && (
          <div className="signature-placeholder">
            Signez ici avec votre souris ou votre doigt
          </div>
        )}
      </div>

      {/* Bouton effacer */}
      <div className="signature-actions">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={!hasDrawn || disabled || isLoading}
          className="btn-clear"
        >
          🗑️ Effacer
        </button>
      </div>

      {/* Consentement RGPD */}
      <div className="signature-consent">
        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            disabled={disabled || isLoading}
          />
          <span className="consent-label">
            <strong>J'accepte le consentement RGPD</strong> pour la signature électronique
          </span>
        </label>

        {showConsentText && (
          <div className="consent-text-collapsible">
            <details>
              <summary>📄 Lire le texte complet du consentement</summary>
              <div className="consent-text-full">
                <pre>{CONSENT_TEXT}</pre>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Informations du signataire */}
      {signerInfo.name && (
        <div className="signer-info">
          <p>
            <strong>Signataire:</strong> {signerInfo.name}
          </p>
          {signerInfo.email && (
            <p>
              <strong>Email:</strong> {signerInfo.email}
            </p>
          )}
          {signerInfo.role && (
            <p>
              <strong>Rôle:</strong> {signerInfo.role}
            </p>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="signature-error">
          <strong>❌ Erreur:</strong> {error}
        </div>
      )}

      {/* Boutons de validation */}
      <div className="signature-submit-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn-cancel"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasDrawn || !consentGiven || disabled || isLoading}
          className="btn-submit"
        >
          {isLoading ? '⏳ Signature en cours...' : '✅ Valider la signature'}
        </button>
      </div>

      {/* Loader */}
      {isLoading && (
        <div className="signature-loader">
          <div className="spinner" />
          <p>Génération du certificat eIDAS et enregistrement sécurisé...</p>
        </div>
      )}
    </div>
  );
};

export default ElectronicSignaturePad;
