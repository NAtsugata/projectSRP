// src/components/ir-shower/IRFormElements.js
// Composants UI réutilisables pour les formulaires IR Douche

import React from 'react';

export const Section = ({ title, children, style, className = "" }) => (
  <div
    className={`ir-section ${className}`}
    style={{
      border: "1px solid var(--border-color, #e5e7eb)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      ...style,
    }}
  >
    {title && <h3 className="ir-section-title" style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700 }}>{title}</h3>}
    {children}
  </div>
);

export const Row = ({ children }) => (
  <div className="ir-row">{children}</div>
);

export const Col = ({ span = 6, children }) => (
  <div className={`ir-col span-${Math.min(12, Math.max(1, span))}`}>{children}</div>
);

export const Label = ({ children, required }) => (
  <label className="ir-label" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
    {children} {required && <span style={{ color: "var(--color-danger, #ef4444)" }}>*</span>}
  </label>
);

export const Input = (props) => (
  <input
    {...props}
    className={`ir-input ${props.className || ''}`}
    style={{
      width: "100%",
      border: "1px solid var(--border-color, #cbd5e1)",
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 14,
      minHeight: 44,
      ...props.style
    }}
  />
);

export const Check = ({ label, ...props }) => (
  <label className="ir-check" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12 }}>
    <input type="checkbox" {...props} /> {label}
  </label>
);

export const Radio = ({ label, name, ...props }) => (
  <label className="ir-radio" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12 }}>
    <input type="radio" name={name} {...props} /> {label}
  </label>
);

export const Small = ({ children }) => (
  <div className="ir-small" style={{ fontSize: 12 }}>{children}</div>
);
