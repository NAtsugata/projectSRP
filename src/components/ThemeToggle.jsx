/**
 * ====================================================================
 * COMPOSANT: ThemeToggle
 * ====================================================================
 * Bouton pour basculer entre le th├¿me clair et sombre
 * Fonctionnalit├®s:
 * - Toggle simple (clair Ôåö sombre)
 * - Animation fluide
 * - Ic├┤nes soleil/lune
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
        {isDark ? 'ÔÿÇ´©Å' : '­ƒîÖ'}
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
 * Version avec menu d├®roulant (Light / Dark / Auto)
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
        aria-label="S├®lectionner le th├¿me"
      >
        {theme === THEMES.DARK && '­ƒîÖ Sombre'}
        {theme === THEMES.LIGHT && 'ÔÿÇ´©Å Clair'}
        {theme === THEMES.AUTO && '­ƒöä Auto'}
        <span className="dropdown-arrow">Ôû╝</span>
      </button>

      {isOpen && (
        <div className="theme-toggle-menu-dropdown">
          <button
            onClick={() => handleSelect(THEMES.LIGHT)}
            className={`menu-item ${theme === THEMES.LIGHT ? 'active' : ''}`}
          >
            ÔÿÇ´©Å Clair
            {theme === THEMES.LIGHT && <span className="checkmark">Ô£ô</span>}
          </button>
          <button
            onClick={() => handleSelect(THEMES.DARK)}
            className={`menu-item ${theme === THEMES.DARK ? 'active' : ''}`}
          >
            ­ƒîÖ Sombre
            {theme === THEMES.DARK && <span className="checkmark">Ô£ô</span>}
          </button>
          <button
            onClick={() => handleSelect(THEMES.AUTO)}
            className={`menu-item ${theme === THEMES.AUTO ? 'active' : ''}`}
          >
            ­ƒöä Auto (Syst├¿me)
            {theme === THEMES.AUTO && <span className="checkmark">Ô£ô</span>}
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
