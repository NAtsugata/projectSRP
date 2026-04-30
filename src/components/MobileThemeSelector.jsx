/**
 * ====================================================================
 * COMPOSANT: MobileThemeSelector
 * ====================================================================
 * S├®lecteur de th├¿me optimis├® pour mobile
 * Fonctionnalit├®s:
 * - Gros boutons tactiles (44px minimum)
 * - Texte clair "Th├¿me Clair" / "Th├¿me Sombre"
 * - Animation de s├®lection
 * - Feedback visuel imm├®diat
 * ====================================================================
 */

import React from 'react';
import useTheme from '../hooks/useTheme';
import './MobileThemeSelector.css';

/**
 * S├®lecteur de th├¿me avec gros boutons (adapt├® mobile)
 */
const MobileThemeSelector = ({
  variant = 'buttons', // 'buttons' ou 'segmented'
  fullWidth = false,
}) => {
  const { theme, effectiveTheme, setDarkMode, setLightMode, THEMES } = useTheme();

  if (variant === 'segmented') {
    return (
      <div className={`mobile-theme-segmented ${fullWidth ? 'full-width' : ''}`}>
        <button
          onClick={setLightMode}
          className={`theme-segment ${theme === THEMES.LIGHT ? 'active' : ''}`}
          aria-pressed={theme === THEMES.LIGHT}
        >
          <span className="theme-icon">ÔÿÇ´©Å</span>
          <span className="theme-label">Clair</span>
        </button>
        <button
          onClick={setDarkMode}
          className={`theme-segment ${theme === THEMES.DARK ? 'active' : ''}`}
          aria-pressed={theme === THEMES.DARK}
        >
          <span className="theme-icon">­ƒîÖ</span>
          <span className="theme-label">Sombre</span>
        </button>
      </div>
    );
  }

  // Variant: buttons (default)
  return (
    <div className={`mobile-theme-selector ${fullWidth ? 'full-width' : ''}`}>
      <button
        onClick={setLightMode}
        className={`theme-button theme-light ${theme === THEMES.LIGHT ? 'active' : ''}`}
        aria-pressed={theme === THEMES.LIGHT}
      >
        <span className="theme-button-icon">ÔÿÇ´©Å</span>
        <span className="theme-button-label">Th├¿me Clair</span>
        {theme === THEMES.LIGHT && <span className="checkmark">Ô£ô</span>}
      </button>

      <button
        onClick={setDarkMode}
        className={`theme-button theme-dark ${theme === THEMES.DARK ? 'active' : ''}`}
        aria-pressed={theme === THEMES.DARK}
      >
        <span className="theme-button-icon">­ƒîÖ</span>
        <span className="theme-button-label">Th├¿me Sombre</span>
        {theme === THEMES.DARK && <span className="checkmark">Ô£ô</span>}
      </button>
    </div>
  );
};

/**
 * Version compacte pour les headers/navbars
 */
export const MobileThemeToggleCompact = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="mobile-theme-toggle-compact"
      aria-label={isDark ? 'Activer le th├¿me clair' : 'Activer le th├¿me sombre'}
    >
      <span className="toggle-icon">{isDark ? 'ÔÿÇ´©Å' : '­ƒîÖ'}</span>
      <span className="toggle-text">{isDark ? 'Clair' : 'Sombre'}</span>
    </button>
  );
};

/**
 * Version avec ic├┤ne seule (tr├¿s compact)
 */
export const MobileThemeToggleIcon = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="mobile-theme-toggle-icon"
      aria-label={isDark ? 'Activer le th├¿me clair' : 'Activer le th├¿me sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      {isDark ? 'ÔÿÇ´©Å' : '­ƒîÖ'}
    </button>
  );
};

/**
 * Carte de pr├®f├®rence de th├¿me (pour page de param├¿tres)
 */
export const MobileThemeCard = () => {
  const { theme, setLightMode, setDarkMode, setAutoMode, THEMES } = useTheme();

  return (
    <div className="mobile-theme-card">
      <h3 className="card-title">­ƒÄ¿ Apparence</h3>
      <p className="card-description">Choisissez le th├¿me de l'application</p>

      <div className="theme-options">
        <button
          onClick={setLightMode}
          className={`theme-option ${theme === THEMES.LIGHT ? 'selected' : ''}`}
        >
          <div className="option-preview light-preview">
            <div className="preview-header"></div>
            <div className="preview-content"></div>
          </div>
          <div className="option-info">
            <span className="option-icon">ÔÿÇ´©Å</span>
            <span className="option-name">Clair</span>
          </div>
          {theme === THEMES.LIGHT && <span className="option-check">Ô£ô</span>}
        </button>

        <button
          onClick={setDarkMode}
          className={`theme-option ${theme === THEMES.DARK ? 'selected' : ''}`}
        >
          <div className="option-preview dark-preview">
            <div className="preview-header"></div>
            <div className="preview-content"></div>
          </div>
          <div className="option-info">
            <span className="option-icon">­ƒîÖ</span>
            <span className="option-name">Sombre</span>
          </div>
          {theme === THEMES.DARK && <span className="option-check">Ô£ô</span>}
        </button>

        <button
          onClick={setAutoMode}
          className={`theme-option ${theme === THEMES.AUTO ? 'selected' : ''}`}
        >
          <div className="option-preview auto-preview">
            <div className="preview-split">
              <div className="preview-half light"></div>
              <div className="preview-half dark"></div>
            </div>
          </div>
          <div className="option-info">
            <span className="option-icon">­ƒöä</span>
            <span className="option-name">Auto</span>
          </div>
          {theme === THEMES.AUTO && <span className="option-check">Ô£ô</span>}
        </button>
      </div>
    </div>
  );
};

export default MobileThemeSelector;
