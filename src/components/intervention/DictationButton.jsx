// src/components/intervention/DictationButton.jsx
// Dictée vocale → texte (reconnaissance vocale Web Speech API)
// Utilise continuous=false + relance auto pour éviter les doublons

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

  // listeningRef = source de vérité pour l'état d'écoute (évite les stale closures)
  const listeningRef = useRef(false);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const supported = !!SpeechRecognition;

  // Démarre une session unique (continuous=false) et se relance à la fin
  const startSession = useCallback(() => {
    if (!supported || !listeningRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;    // ← clé : une seule utterance par session
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      // On parcourt TOUS les résultats de cette session (jamais de chevauchement
      // car continuous=false → chaque session ne contient qu'une phrase)
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interimText += t;
        }
      }
      if (finalText.trim()) {
        const clean = finalText.trim();
        onAppendText?.(clean.charAt(0).toUpperCase() + clean.slice(1) + ' ');
        setInterim('');
      } else {
        setInterim(interimText);
      }
    };

    recognition.onend = () => {
      setInterim('');
      if (listeningRef.current) {
        // Relance automatique (courte pause pour éviter le flooding)
        setTimeout(() => startSession(), 80);
      } else {
        setListening(false);
      }
    };

    recognition.onerror = (e) => {
      logger.warn('SpeechRecognition error:', e.error);
      if (e.error === 'no-speech') {
        // Silence : on relance silencieusement si toujours en écoute
        return; // onend sera appelé, relancera tout seul
      }
      if (e.error === 'aborted') return; // arrêt volontaire (stop)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Micro refusé. Autorisez le microphone dans les paramètres.');
      } else {
        setError('Erreur de reconnaissance vocale.');
      }
      listeningRef.current = false;
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      // Si une session est déjà ouverte (InvalidStateError), réessayer
      if (listeningRef.current) setTimeout(() => startSession(), 200);
    }
  }, [SpeechRecognition, supported, lang, onAppendText]);

  const start = useCallback(() => {
    if (!supported) {
      setError("Dictée non supportée sur ce navigateur. Utilisez Chrome ou Safari.");
      return;
    }
    setError(null);
    listeningRef.current = true;
    setListening(true);
    startSession();
  }, [supported, startSession]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setInterim('');
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  // Nettoyage au démontage
  useEffect(() => () => {
    listeningRef.current = false;
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
  }, []);

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
              animation: 'srpPulse 1s ease-in-out infinite', flexShrink: 0,
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
