/**
 * ====================================================================
 * COMPOSANT: ThemeToggle
 * ====================================================================
 * Bouton pour basculer entre le thème clair et sombre
 * Fonctionnalités:
 * - Toggle simple (clair ↔ sombre)
 * - Animation fluide
 * - Icônes soleil/lune
 * - Tooltip informatif
 * ====================================================================
 */

import React from 'react';
import useTheme from '../hooks/useTheme';
import './ThemeToggle.css';

const ThemeToggle = ({ compact = false, showLabel = true }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      <span className="theme-toggle-icon">
        {isDark ? '☀️' : '🌙'}
      </span>
      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? 'Clair' : 'Sombre'}
        </span>
      )}
    </button>
  );
};

/**
 * Version avec menu déroulant (Light / Dark / Auto)
 */
export const ThemeToggleMenu = () => {
  const { theme, setTheme, THEMES } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (selectedTheme) => {
    setTheme(selectedTheme);
    setIsOpen(false);
  };

  return (
    <div className="theme-toggle-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="theme-toggle-menu-button"
        aria-label="Sélectionner le thème"
      >
        {theme === THEMES.DARK && '🌙 Sombre'}
        {theme === THEMES.LIGHT && '☀️ Clair'}
        {theme === THEMES.AUTO && '🔄 Auto'}
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="theme-toggle-menu-dropdown">
          <button
            onClick={() => handleSelect(THEMES.LIGHT)}
            className={`menu-item ${theme === THEMES.LIGHT ? 'active' : ''}`}
          >
            ☀️ Clair
            {theme === THEMES.LIGHT && <span className="checkmark">✓</span>}
          </button>
          <button
            onClick={() => handleSelect(THEMES.DARK)}
            className={`menu-item ${theme === THEMES.DARK ? 'active' : ''}`}
          >
            🌙 Sombre
            {theme === THEMES.DARK && <span className="checkmark">✓</span>}
          </button>
          <button
            onClick={() => handleSelect(THEMES.AUTO)}
            className={`menu-item ${theme === THEMES.AUTO ? 'active' : ''}`}
          >
            🔄 Auto (Système)
            {theme === THEMES.AUTO && <span className="checkmark">✓</span>}
          </button>
        </div>
      )}

      {/* Overlay pour fermer le menu */}
      {isOpen && (
        <div
          className="theme-toggle-menu-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default ThemeToggle;
