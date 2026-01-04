// =============================
// FILE: src/components/SignaturePad.js
// Composant de capture de signature tactile/souris
// =============================

import React, { useRef, useEffect, useState, useCallback } from 'react';

function SignaturePad({ onSave, onClear, initialValue = null, width = 300, height = 150 }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    // Initialiser le canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Configuration du canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Charger la signature existante si présente
        if (initialValue) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                setHasSignature(true);
            };
            img.src = initialValue;
        }
    }, [initialValue]);

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

        // Sauvegarder automatiquement
        if (onSave) {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    }, [isDrawing, onSave]);

    // Effacer la signature
    const clearSignature = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);

        if (onClear) {
            onClear();
        }
        if (onSave) {
            onSave(null);
        }
    }, [onClear, onSave]);

    return (
        <div className="signature-pad-container">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    touchAction: 'none',
                    cursor: 'crosshair',
                    background: '#ffffff',
                    width: '100%',
                    maxWidth: `${width}px`,
                    height: 'auto',
                    aspectRatio: `${width}/${height}`
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
                justifyContent: 'flex-end'
            }}>
                {hasSignature && (
                    <button
                        type="button"
                        onClick={clearSignature}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(244, 67, 54, 0.2)',
                            border: '1px solid rgba(244, 67, 54, 0.5)',
                            borderRadius: '4px',
                            color: '#f44336',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Effacer
                    </button>
                )}
            </div>
            {!hasSignature && (
                <p style={{
                    margin: '0.5rem 0 0',
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.5)',
                    textAlign: 'center'
                }}>
                    Dessinez votre signature ci-dessus
                </p>
            )}
        </div>
    );
}

export default SignaturePad;
