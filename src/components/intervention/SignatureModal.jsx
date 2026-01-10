// src/components/intervention/SignatureModal.js
// Modal plein écran pour capturer la signature client

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../ui';
import './SignatureModal.css';

/**
 * Modal de signature avec canvas touch/mouse
 * @param {Function} onSave - Callback avec signature en base64
 * @param {Function} onCancel - Callback d'annulation
 * @param {string} existingSignature - Signature existante (base64)
 */
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMobile = window.innerWidth < 768;

    // Configuration taille canvas
    canvas.width = Math.min(window.innerWidth * 0.9, 600);
    canvas.height = isMobile ? window.innerHeight * 0.5 : 300;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Charge signature existante
    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
        setCanvasReady(true);
      };
      img.onerror = () => {
        console.error('Erreur chargement signature existante');
        setCanvasReady(true);
      };
      img.src = existingSignature;
    } else {
      setCanvasReady(true);
    }

    // État du dessin
    let drawing = false;
    let lastPos = null;

    // Obtenir position (mouse ou touch)
    const getPosition = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    // Handlers dessin
    const startDrawing = (e) => {
      e.preventDefault();
      drawing = true;
      setHasDrawn(true);
      lastPos = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
    };

    const stopDrawing = (e) => {
      e.preventDefault();
      drawing = false;
      lastPos = null;
    };

    const draw = (e) => {
      if (!drawing) return;
      e.preventDefault();

      const currentPos = getPosition(e);

      if (lastPos) {
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.stroke();
      }

      lastPos = currentPos;
    };

    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchmove', draw);
    };
  }, [existingSignature]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleSave = () => {
    if (!hasDrawn) {
      alert('Veuillez dessiner une signature');
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const signatureDataUrl = canvas.toDataURL('image/png');
      onSave(signatureDataUrl);
    }
  };

  // Prévenir scroll pendant signature
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="signature-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="signature-title">
      <div className="signature-modal-content">
        <h3 id="signature-title" className="signature-modal-title">
          ✍️ Signature du client
        </h3>

        <p className="signature-modal-help">
          Dessinez la signature avec votre doigt ou la souris
        </p>

        {!canvasReady && (
          <div className="signature-loading">
            Chargement du canvas...
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="signature-canvas"
          aria-label="Zone de signature"
          role="application"
          style={{ opacity: canvasReady ? 1 : 0 }}
        />

        <div className="signature-modal-footer">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>

          <Button variant="secondary" onClick={handleClear}>
            Effacer
          </Button>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasDrawn}
          >
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
