// src/components/intervention/CallButtons.js
// Boutons d'appel ultra-visibles pour contact rapide

import React from 'react';
import './CallButtons.css';

/**
 * CallButtons - Boutons d'appel géants et visibles
 *
 * @param {Object} intervention - Intervention avec client_phone, secondary_phone
 * @param {Function} onCall - Callback après appel
 */
const CallButtons = ({ intervention, onCall }) => {
  const handleCall = (phone, label) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
      onCall?.(label);
      console.log(`📞 Appel lancé vers ${label}:`, phone);
    }
  };

  const handleSMS = (phone) => {
    if (phone) {
      const message = encodeURIComponent(`Bonjour, je suis en route pour votre intervention.`);
      window.location.href = `sms:${phone}?body=${message}`;
      console.log(`💬 SMS lancé vers:`, phone);
    }
  };

  const hasPhone = intervention?.client_phone;
  const hasSecondary = intervention?.secondary_phone;

  if (!hasPhone && !hasSecondary) {
    return (
      <div className="call-buttons-container">
        <div className="call-buttons-empty">
          <span className="empty-icon">📵</span>
          <p>Aucun numéro de téléphone renseigné</p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-buttons-container">
      <h3 className="call-buttons-title">📞 Contacts rapides</h3>

      <div className="call-buttons-grid">
        {/* Téléphone principal */}
        {hasPhone && (
          <div className="call-button-card call-button-primary">
            <div className="call-button-header">
              <span className="call-button-label">Client principal</span>
              <span className="call-button-number">{intervention.client_phone}</span>
            </div>
            <div className="call-button-actions">
              <button
                onClick={() => handleCall(intervention.client_phone, 'Client principal')}
                className="btn-call btn-call-primary"
              >
                <span className="btn-call-icon">📞</span>
                <span className="btn-call-text">Appeler</span>
              </button>
              <button
                onClick={() => handleSMS(intervention.client_phone)}
                className="btn-call btn-call-secondary"
              >
                <span className="btn-call-icon">💬</span>
                <span className="btn-call-text">SMS</span>
              </button>
            </div>
          </div>
        )}

        {/* Téléphone secondaire */}
        {hasSecondary && (
          <div className="call-button-card">
            <div className="call-button-header">
              <span className="call-button-label">Contact secondaire</span>
              <span className="call-button-number">{intervention.secondary_phone}</span>
            </div>
            <div className="call-button-actions">
              <button
                onClick={() => handleCall(intervention.secondary_phone, 'Contact secondaire')}
                className="btn-call btn-call-primary"
              >
                <span className="btn-call-icon">📞</span>
                <span className="btn-call-text">Appeler</span>
              </button>
              <button
                onClick={() => handleSMS(intervention.secondary_phone)}
                className="btn-call btn-call-secondary"
              >
                <span className="btn-call-icon">💬</span>
                <span className="btn-call-text">SMS</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Infos supplémentaires */}
      {intervention?.client_email && (
        <div className="call-info-extra">
          <span className="info-icon">📧</span>
          <a href={`mailto:${intervention.client_email}`} className="info-link">
            {intervention.client_email}
          </a>
        </div>
      )}

      {intervention?.ticket_number && (
        <div className="call-info-extra">
          <span className="info-icon">🎫</span>
          <span className="info-text">
            Ticket : <strong>{intervention.ticket_number}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default CallButtons;
