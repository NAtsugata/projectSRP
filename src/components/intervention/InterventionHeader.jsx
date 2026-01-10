// src/components/intervention/InterventionHeader.js
// Header moderne avec infos clés et actions rapides

import React from 'react';
import { ChevronLeftIcon, AlertTriangleIcon } from '../SharedUI';
import './InterventionHeader.css';

const InterventionHeader = ({
  intervention,
  onBack,
  onCall,
  onNavigate
}) => {
  const isUrgent = intervention?.additional_needs?.some(need => need.isUrgent);
  const hasSAV = intervention?.follow_up_required;

  const handleCall = () => {
    if (intervention?.client_phone) {
      window.location.href = `tel:${intervention.client_phone}`;
      onCall?.();
    }
  };

  const handleNavigate = () => {
    if (intervention?.address) {
      const address = encodeURIComponent(intervention.address);
      // Détecter iOS ou Android
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS
        ? `maps://maps.google.com/maps?daddr=${address}`
        : `https://www.google.com/maps/dir/?api=1&destination=${address}`;
      window.open(url, '_blank');
      onNavigate?.();
    }
  };

  return (
    <div className="intervention-header">
      {/* Top Bar */}
      <div className="header-top">
        <button
          onClick={onBack}
          className="back-button"
          aria-label="Retour"
        >
          <ChevronLeftIcon />
        </button>

        <div className="header-badges">
          {isUrgent && (
            <span className="badge badge-urgent">
              <AlertTriangleIcon />
              URGENT
            </span>
          )}
          {hasSAV && (
            <span className="badge badge-sav">
              SAV
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="header-main">
        <div className="client-info">
          <h1 className="client-name">{intervention?.client || 'Client'}</h1>
          <p className="service-type">{intervention?.service || 'Service'}</p>
        </div>

        <div className="header-actions">
          {intervention?.client_phone && (
            <button
              onClick={handleCall}
              className="action-btn action-call"
              title="Appeler le client"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </button>
          )}

          {intervention?.address && (
            <button
              onClick={handleNavigate}
              className="action-btn action-navigate"
              title="Navigation GPS"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Address */}
      {intervention?.address && (
        <div className="header-address">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>{intervention.address}</span>
        </div>
      )}

      {/* Date & Time */}
      <div className="header-datetime">
        <div className="datetime-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{new Date(intervention?.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })}</span>
        </div>
        {intervention?.time && (
          <div className="datetime-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{intervention.time}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterventionHeader;
