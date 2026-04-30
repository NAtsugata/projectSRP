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
      <span>Brouillon récupéré (sauvegardé le {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
      <button type="button" onClick={onIgnore} style={{
        background: 'transparent',
        border: '1px solid currentColor',
        borderRadius: '4px',
        padding: '4px 8px',
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
  const [formData, setFormData] = useState(defaultValues);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const timeoutRef = useRef(null);

  // Initialize from draft
  useEffect(() => {
    const draftStr = localStorage.getItem(`draft_${formKey}`);
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        const age = Date.now() - draft.timestamp;
        if (age < 24 * 60 * 60 * 1000) { // < 24h
          setFormData(draft.data);
          setHasDraft(true);
          setLastSavedAt(draft.timestamp);
        } else {
          localStorage.removeItem(`draft_${formKey}`);
        }
      } catch (e) {
        console.error('Error parsing draft', e);
      }
    }
  }, [formKey]); // run once on mount per formKey

  const saveDraft = useCallback((dataToSave) => {
    // Only save if it has meaning (not default values right after clear)
    localStorage.setItem(`draft_${formKey}`, JSON.stringify({
      data: dataToSave,
      timestamp: Date.now()
    }));
  }, [formKey]);

  // Debounced save
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveDraft(formData);
    }, 800);
    
    return () => clearTimeout(timeoutRef.current);
  }, [formData, saveDraft]);

  // Force save on visibility change and pagehide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveDraft(formData);
      }
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
