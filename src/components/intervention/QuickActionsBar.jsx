// src/components/intervention/QuickActionsBar.js
// Barre d'actions rapides pour employés

import React, { useState } from 'react';
import './QuickActionsBar.css';

const QuickActionsBar = ({ intervention, onAction }) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const toast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleCopyAddress = () => {
    if (intervention?.address) {
      navigator.clipboard.writeText(intervention.address);
      toast('Adresse copiée !');
      onAction?.('copy-address');
    }
  };

  const handleCopyClient = () => {
    const info = `${intervention?.client || ''}\n${intervention?.client_phone || ''}\n${intervention?.address || ''}`;
    navigator.clipboard.writeText(info);
    toast('Infos client copiées !');
    onAction?.('copy-client');
  };

  const handleShare = async () => {
    const text = `Intervention ${intervention?.client || ''}\n📍 ${intervention?.address || ''}\n📅 ${new Date(intervention?.date).toLocaleDateString('fr-FR')}`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
        onAction?.('share');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyClient();
        }
      }
    } else {
      handleCopyClient();
    }
  };

  const handleSMS = () => {
    if (intervention?.client_phone) {
      const message = encodeURIComponent(`Bonjour, je suis en route pour votre intervention.`);
      window.location.href = `sms:${intervention.client_phone}?body=${message}`;
      onAction?.('sms');
    }
  };

  return (
    <>
      <div className="quick-actions-bar">
        <button
          onClick={handleCopyAddress}
          className="quick-action"
          title="Copier l'adresse"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copier adresse</span>
        </button>

        <button
          onClick={handleShare}
          className="quick-action"
          title="Partager"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span>Partager</span>
        </button>

        {intervention?.client_phone && (
          <button
            onClick={handleSMS}
            className="quick-action"
            title="Envoyer SMS"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>SMS</span>
          </button>
        )}

        <button
          onClick={handleCopyClient}
          className="quick-action"
          title="Copier infos client"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Copier client</span>
        </button>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="toast-notification">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};

export default QuickActionsBar;
