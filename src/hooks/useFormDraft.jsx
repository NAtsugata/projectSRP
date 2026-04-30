import React, { useState, useEffect, useCallback, useRef } from 'react';

export const DraftBanner = ({ lastSavedAt, onIgnore }) => {
  if (!lastSavedAt) return null;
  return (
    <div className="draft-banner" style={{
      background: '#eef2ff',
      color: '#4338ca',
      padding: '10px 15px',
      borderRadius: '8px',
      marginBottom: '15px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.9rem',
      border: '1px solid #c7d2fe'
    }}>
      <span>📝 Brouillon récupéré (sauvegardé à {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
      <button type="button" onClick={onIgnore} style={{
        background: 'transparent',
        border: '1px solid currentColor',
        borderRadius: '4px',
        padding: '4px 10px',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '0.8rem'
      }}>
        Ignorer
      </button>
    </div>
  );
};

export const useFormDraft = (formKey, defaultValues) => {
  const [formData, setFormData] = useState(() => {
    // Initialize from draft on first render
    try {
      const draftStr = localStorage.getItem(`draft_${formKey}`);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        const age = Date.now() - draft.timestamp;
        if (age < 24 * 60 * 60 * 1000) {
          return draft.data;
        }
        localStorage.removeItem(`draft_${formKey}`);
      }
    } catch (e) {
      console.error('Error parsing draft', e);
    }
    return defaultValues;
  });

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      const draftStr = localStorage.getItem(`draft_${formKey}`);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        return Date.now() - draft.timestamp < 24 * 60 * 60 * 1000;
      }
    } catch (e) { /* ignore */ }
    return false;
  });

  const [lastSavedAt, setLastSavedAt] = useState(() => {
    try {
      const draftStr = localStorage.getItem(`draft_${formKey}`);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
          return draft.timestamp;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  });

  const timeoutRef = useRef(null);

  const saveDraft = useCallback((dataToSave) => {
    const ts = Date.now();
    localStorage.setItem(`draft_${formKey}`, JSON.stringify({
      data: dataToSave,
      timestamp: ts
    }));
    setLastSavedAt(ts);
  }, [formKey]);

  // Debounced save on formData change
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveDraft(formData);
    }, 800);
    return () => clearTimeout(timeoutRef.current);
  }, [formData, saveDraft]);

  // Force save on visibility change and pagehide (iOS)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveDraft(formData);
    };
    const handlePageHide = () => saveDraft(formData);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [formData, saveDraft]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft_${formKey}`);
    setHasDraft(false);
    setLastSavedAt(null);
    setFormData(defaultValues);
  }, [formKey, defaultValues]);

  return { formData, setFormData, clearDraft, hasDraft, lastSavedAt };
};
