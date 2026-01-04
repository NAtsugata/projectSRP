// =============================
// FILE: src/components/SignaturePad.js
// Composant de capture de signature tactile/souris
// Avec mode plein écran pour mobile
// =============================

import React, { useRef, useEffect, useState, useCallback } from 'react';

function SignaturePad({ onSave, onClear, initialValue = null, width = 300, height = 150 }) {
    const canvasRef = useRef(null);
    const fullscreenCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

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

    // Initialiser le canvas fullscreen quand il s'ouvre
    useEffect(() => {
        if (!isFullscreen) return;

        const canvas = fullscreenCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Copier la signature existante si présente
        if (initialValue) {
            const img = new Image();
            img.onload = () => {
                // Redimensionner pour s'adapter au canvas fullscreen
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            };
            img.src = initialValue;
        }
    }, [isFullscreen, initialValue]);

    // Obtenir les coordonnées (souris ou tactile)
    const getCoordinates = useCallback((e, canvasElement) => {
        const canvas = canvasElement || canvasRef.current;
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
    const startDrawing = useCallback((e, canvasElement) => {
        e.preventDefault();
        const canvas = canvasElement || canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordinates(e, canvas);

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasSignature(true);
    }, [getCoordinates]);

    // Dessiner
    const draw = useCallback((e, canvasElement) => {
        if (!isDrawing) return;
        e.preventDefault();

        const canvas = canvasElement || canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordinates(e, canvas);

        ctx.lineTo(x, y);
        ctx.stroke();
    }, [isDrawing, getCoordinates]);

    // Arrêter de dessiner
    const stopDrawing = useCallback((canvasElement) => {
        if (!isDrawing) return;

        const canvas = canvasElement || canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    }, [isDrawing]);

    // Effacer la signature
    const clearSignature = useCallback((canvasElement) => {
        const canvas = canvasElement || canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);

        if (onClear) {
            onClear();
        }
        if (onSave && !isFullscreen) {
            onSave(null);
        }
    }, [onClear, onSave, isFullscreen]);

    // Sauvegarder depuis le canvas principal
    const saveFromCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !onSave) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    }, [onSave]);

    // Ouvrir le mode plein écran
    const openFullscreen = useCallback(() => {
        setIsFullscreen(true);
        // Empêcher le scroll du body
        document.body.style.overflow = 'hidden';
    }, []);

    // Fermer le mode plein écran sans sauvegarder
    const closeFullscreen = useCallback(() => {
        setIsFullscreen(false);
        document.body.style.overflow = '';
    }, []);

    // Confirmer et sauvegarder depuis le mode plein écran
    const confirmFullscreen = useCallback(() => {
        const fullscreenCanvas = fullscreenCanvasRef.current;
        const mainCanvas = canvasRef.current;

        if (fullscreenCanvas && mainCanvas) {
            // Copier la signature fullscreen vers le canvas principal
            const mainCtx = mainCanvas.getContext('2d');
            mainCtx.fillStyle = '#ffffff';
            mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

            // Redimensionner pour s'adapter
            mainCtx.drawImage(fullscreenCanvas, 0, 0, mainCanvas.width, mainCanvas.height);

            // Sauvegarder
            if (onSave) {
                const dataUrl = mainCanvas.toDataURL('image/png');
                onSave(dataUrl);
            }
            setHasSignature(true);
        }

        setIsFullscreen(false);
        document.body.style.overflow = '';
    }, [onSave]);

    // Effacer dans le mode fullscreen
    const clearFullscreen = useCallback(() => {
        clearSignature(fullscreenCanvasRef.current);
    }, [clearSignature]);

    return (
        <div className="signature-pad-container">
            {/* Canvas principal (petit) */}
            <div
                onClick={openFullscreen}
                style={{ cursor: 'pointer', position: 'relative' }}
            >
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderRadius: '8px',
                        touchAction: 'none',
                        background: '#ffffff',
                        width: '100%',
                        maxWidth: `${width}px`,
                        height: 'auto',
                        aspectRatio: `${width}/${height}`,
                        pointerEvents: 'none' // Désactiver le dessin direct, forcer fullscreen
                    }}
                />
                {/* Overlay pour indiquer de cliquer */}
                {!hasSignature && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        color: '#333',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                    }}>
                        ✍️ Cliquer pour signer
                    </div>
                )}
                {hasSignature && (
                    <div style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '5px',
                        background: 'rgba(76, 175, 80, 0.9)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                    }}>
                        ✓ Signé
                    </div>
                )}
            </div>

            {/* Boutons */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.5rem',
                justifyContent: 'space-between'
            }}>
                <button
                    type="button"
                    onClick={openFullscreen}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(33, 150, 243, 0.2)',
                        border: '1px solid rgba(33, 150, 243, 0.5)',
                        borderRadius: '4px',
                        color: '#2196F3',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    ✍️ {hasSignature ? 'Modifier' : 'Signer'}
                </button>
                {hasSignature && (
                    <button
                        type="button"
                        onClick={() => {
                            clearSignature(canvasRef.current);
                            if (onSave) onSave(null);
                        }}
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

            {/* Mode plein écran */}
            {isFullscreen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 10000,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1rem'
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        color: 'white'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>✍️ Signature</h3>
                        <button
                            type="button"
                            onClick={closeFullscreen}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                padding: '0.5rem'
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Zone de signature fullscreen */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem'
                    }}>
                        <canvas
                            ref={fullscreenCanvasRef}
                            width={window.innerWidth - 40}
                            height={Math.min(window.innerHeight - 200, 400)}
                            style={{
                                background: '#ffffff',
                                borderRadius: '8px',
                                touchAction: 'none',
                                cursor: 'crosshair',
                                maxWidth: '100%'
                            }}
                            onMouseDown={(e) => startDrawing(e, fullscreenCanvasRef.current)}
                            onMouseMove={(e) => draw(e, fullscreenCanvasRef.current)}
                            onMouseUp={() => stopDrawing(fullscreenCanvasRef.current)}
                            onMouseLeave={() => stopDrawing(fullscreenCanvasRef.current)}
                            onTouchStart={(e) => startDrawing(e, fullscreenCanvasRef.current)}
                            onTouchMove={(e) => draw(e, fullscreenCanvasRef.current)}
                            onTouchEnd={() => stopDrawing(fullscreenCanvasRef.current)}
                        />
                    </div>

                    {/* Boutons d'action */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'center'
                    }}>
                        <button
                            type="button"
                            onClick={clearFullscreen}
                            style={{
                                padding: '1rem 2rem',
                                background: 'rgba(244, 67, 54, 0.8)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            🗑️ Effacer
                        </button>
                        <button
                            type="button"
                            onClick={confirmFullscreen}
                            style={{
                                padding: '1rem 2rem',
                                background: 'rgba(76, 175, 80, 0.9)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                flex: 1,
                                maxWidth: '200px'
                            }}
                        >
                            ✓ Valider
                        </button>
                    </div>

                    {/* Instructions */}
                    <p style={{
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.6)',
                        marginTop: '1rem',
                        fontSize: '0.85rem'
                    }}>
                        Dessinez votre signature dans la zone blanche
                    </p>
                </div>
            )}
        </div>
    );
}

export default SignaturePad;
