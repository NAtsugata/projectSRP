// src/components/employee/QuickAlertButton.jsx
// Bouton d'alerte rapide pour les employés (malade, retard, etc.)

import React, { useState } from 'react';
import { ALERT_TYPES, sendAlert } from '../../services/employeeAlertService';
import { Button } from '../ui';
import './QuickAlertButton.css';

const QuickAlertButton = ({
  userId,
  userName,
  currentIntervention = null,
  onAlertSent
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [estimatedDelay, setEstimatedDelay] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    setSelectedType(null);
    setCustomMessage('');
    setEstimatedDelay('');
    setSuccess(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedType(null);
    setCustomMessage('');
    setEstimatedDelay('');
  };

  const handleSelectType = (type) => {
    setSelectedType(type);
    setCustomMessage(ALERT_TYPES[type].message);
  };

  const handleSend = async () => {
    if (!selectedType) return;

    setIsSending(true);
    try {
      const result = await sendAlert({
        employeeId: userId,
        employeeName: userName,
        alertType: selectedType.toLowerCase(),
        message: customMessage,
        interventionId: currentIntervention?.id || null,
        estimatedDelay: selectedType === 'LATE' ? estimatedDelay : null
      });

      if (!result.error) {
        setSuccess(true);
        onAlertSent?.(result.data);

        // Fermer après 2 secondes
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur envoi alerte:', error);
    } finally {
      setIsSending(false);
    }
  };

  const alertTypes = Object.entries(ALERT_TYPES);

  return (
    <>
      {/* Bouton principal */}
      <button
        className="quick-alert-trigger"
        onClick={handleOpen}
        title="Signaler un problème"
      >
        <span className="alert-icon">🚨</span>
        <span className="alert-text">Signaler</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="quick-alert-overlay" onClick={handleClose}>
          <div
            className="quick-alert-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="quick-alert-success">
                <span className="success-icon">✅</span>
                <h3>Message envoyé !</h3>
                <p>L'administrateur a été notifié.</p>
              </div>
            ) : (
              <>
                <div className="quick-alert-header">
                  <h3>Signaler un problème</h3>
                  <button className="close-btn" onClick={handleClose}>×</button>
                </div>

                {/* Sélection du type */}
                {!selectedType ? (
                  <div className="alert-types-grid">
                    {alertTypes.map(([key, type]) => (
                      <button
                        key={key}
                        className="alert-type-btn"
                        style={{ '--type-color': type.color }}
                        onClick={() => handleSelectType(key)}
                      >
                        <span className="type-emoji">{type.emoji}</span>
                        <span className="type-label">{type.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="alert-form">
                    {/* Type sélectionné */}
                    <div
                      className="selected-type"
                      style={{ '--type-color': ALERT_TYPES[selectedType].color }}
                    >
                      <span>{ALERT_TYPES[selectedType].emoji}</span>
                      <span>{ALERT_TYPES[selectedType].label}</span>
                      <button
                        className="change-type-btn"
                        onClick={() => setSelectedType(null)}
                      >
                        Changer
                      </button>
                    </div>

                    {/* Estimation du retard */}
                    {selectedType === 'LATE' && (
                      <div className="form-field">
                        <label>Retard estimé</label>
                        <div className="delay-options">
                          {['15 min', '30 min', '1h', '+ de 1h'].map(delay => (
                            <button
                              key={delay}
                              className={`delay-btn ${estimatedDelay === delay ? 'selected' : ''}`}
                              onClick={() => setEstimatedDelay(delay)}
                            >
                              {delay}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message personnalisé */}
                    <div className="form-field">
                      <label>Message (optionnel)</label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Ajoutez des détails si nécessaire..."
                        rows={3}
                      />
                    </div>

                    {/* Intervention concernée */}
                    {currentIntervention && (
                      <div className="intervention-info">
                        <span className="info-label">Intervention concernée:</span>
                        <span className="info-value">
                          {currentIntervention.client} - {currentIntervention.time || ''}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="alert-actions">
                      <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isSending}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSend}
                        loading={isSending}
                        disabled={isSending}
                        style={{
                          background: ALERT_TYPES[selectedType].color,
                          borderColor: ALERT_TYPES[selectedType].color
                        }}
                      >
                        Envoyer l'alerte
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default QuickAlertButton;
