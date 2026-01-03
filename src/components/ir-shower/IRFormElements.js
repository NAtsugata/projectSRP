// src/components/ir-shower/IRFormElements.js
// Composants UI réutilisables pour les formulaires IR Douche

import React from 'react';

export const Section = ({ title, children, style, className = "" }) => (
  <div
    className={className}
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      background: "#fff",
      color: "#1f2937",
      ...style,
    }}
  >
    {title && <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700, color: "#1f2937" }}>{title}</h3>}
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
  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
    {children} {required && <span style={{ color: "#ef4444" }}>*</span>}
  </label>
);

export const Input = (props) => (
  <input
    {...props}
    style={{
      width: "100%",
      border: "1px solid #cbd5e1",
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 14,
      minHeight: 44,
      color: "#1f2937",
      backgroundColor: "#fff",
      ...props.style
    }}
  />
);

export const Check = ({ label, ...props }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12, color: "#374151" }}>
    <input type="checkbox" {...props} /> {label}
  </label>
);

export const Radio = ({ label, name, ...props }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, marginRight: 12, color: "#374151" }}>
    <input type="radio" name={name} {...props} /> {label}
  </label>
);

export const Small = ({ children }) => (
  <div style={{ fontSize: 12, color: "#64748b" }}>{children}</div>
);
