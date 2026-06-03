// src/components/intervention/DictationButton.jsx
// Dictée vocale → texte (reconnaissance vocale Web Speech API)
// Transcrit la voix en texte directement dans un champ (notes, etc.)

import React, { useState, useRef, useCallback, useEffect } from 'react';
import logger from '../../utils/logger';

/**
 * Bouton de dictée vocale qui transcrit la parole en texte.
 * @param {Function} onAppendText - reçoit le texte final reconnu à ajouter
 * @param {string} lang - langue (défaut fr-FR)
 * @param {string} size - 'sm' | 'md'
 */
const DictationButton = ({ onAppendText, lang = 'fr-FR', size = 'sm' }) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const supported = !!SpeechRecognition;

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
    setInterim('');
  }, []);

  useEffect(() => () => { try { recognitionRef.current?.abort(); } catch { /* ignore */ } }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("La dictée vocale n'est pas supportée sur ce navigateur. Essayez Chrome ou Safari.");
      return;
    }
    setError(null);

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) {
        // Capitalise la première lettre et ajoute un espace de séparation
        const clean = finalText.trim();
        onAppendText?.(clean ? clean.charAt(0).toUpperCase() + clean.slice(1) + ' ' : '');
        setInterim('');
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (e) => {
      logger.error('Erreur dictée vocale:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Micro refusé. Autorisez l\'accès au microphone.');
      } else if (e.error === 'no-speech') {
        // silencieux, on relance pas
      } else {
        setError('Erreur de reconnaissance vocale.');
      }
      setListening(false);
      setInterim('');
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (err) {
      logger.error('Impossible de démarrer la dictée:', err);
      setError('Impossible de démarrer la dictée.');
    }
  }, [SpeechRecognition, supported, lang, onAppendText]);

  if (!supported) return null;

  const pad = size === 'sm' ? '0.45rem 0.8rem' : '0.6rem 1rem';
  const fontSize = size === 'sm' ? '0.82rem' : '0.9rem';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={listening ? stop : start}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          padding: pad, fontSize, fontWeight: 600, cursor: 'pointer',
          borderRadius: '10px', alignSelf: 'flex-start',
          border: listening ? '1px solid var(--color-danger)' : '1px solid var(--border-color-dark)',
          background: listening ? 'var(--color-danger)' : 'var(--bg-secondary)',
          color: listening ? '#ffffff' : 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
      >
        {listening ? (
          <>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: '#fff',
              animation: 'srpPulse 1s ease-in-out infinite',
            }} />
            Arrêter la dictée
          </>
        ) : (
          <>🎙️ Dicter (parler → écrire)</>
        )}
      </button>

      {interim && (
        <div style={{
          fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-tertiary)',
          padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: '8px',
        }}>
          {interim}…
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }} role="alert">
          {error}
        </div>
      )}

      <style>{`@keyframes srpPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }`}</style>
    </div>
  );
};

export default DictationButton;
