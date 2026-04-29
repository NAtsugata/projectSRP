// src/components/subsidy/InfoTooltip.jsx
// Bulle d'information contextuelle style CEDEO

import React, { useState } from 'react';
import './InfoTooltip.css';

const InfoTooltip = ({ title, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="info-tooltip-wrapper">
      <button
        type="button"
        className="info-tooltip-icon"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        aria-label="Plus d'informations"
      >
        ℹ️
      </button>
      {isVisible && (
        <div className={`info-tooltip-content ${position}`}>
          {title && <strong className="tooltip-title">{title}</strong>}
          <div className="tooltip-text">{children}</div>
        </div>
      )}
    </span>
  );
};

export default InfoTooltip;
