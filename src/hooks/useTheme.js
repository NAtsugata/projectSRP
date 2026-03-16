/**
 * ====================================================================
 * HOOK: useTheme
 * ====================================================================
 * Hook React pour gérer le thème (clair/sombre)
 * Fonctionnalités:
 * - Toggle entre light et dark
 * - Persistence dans localStorage
 * - Support du prefers-color-scheme
 * - Application automatique au DOM
 * ====================================================================
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'app-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto',
};

/**
 * Hook pour gérer le thème de l'application
 * @returns {Object} Fonctions et état du thème
 */
export function useTheme() {
  // État du thème (light, dark, auto)
  const [theme, setTheme] = useState(() => {
    // Récupérer le thème depuis localStorage
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme && Object.values(THEMES).includes(savedTheme)) {
      return savedTheme;
    }
    // Par défaut: auto (détection système)
    return THEMES.AUTO;
  });

  // Thème effectif (résolu si auto)
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    if (theme === THEMES.AUTO) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? THEMES.DARK
        : THEMES.LIGHT;
    }
    return theme;
  });

  /**
   * Appliquer le thème au DOM
   */
  const applyTheme = useCallback((themeToApply) => {
    const root = document.documentElement;

    // Retirer les anciennes classes
    root.classList.remove('dark-theme', 'light-theme');
    root.removeAttribute('data-theme');

    // Appliquer la nouvelle classe et data-attribute
    if (themeToApply === THEMES.DARK) {
      root.classList.add('dark-theme');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.add('light-theme');
      root.setAttribute('data-theme', 'light');
    }
  }, []);

  /**
   * Écouter les changements de préférence système
   */
  useEffect(() => {
    if (theme !== THEMES.AUTO) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      const newTheme = e.matches ? THEMES.DARK : THEMES.LIGHT;
      setEffectiveTheme(newTheme);
      applyTheme(newTheme);
    };

    // Écouter les changements
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme, applyTheme]);

  /**
   * Appliquer le thème effectif au DOM
   */
  useEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme, applyTheme]);

  /**
   * Sauvegarder le thème dans localStorage
   */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  /**
   * Basculer vers le mode sombre
   */
  const setDarkMode = useCallback(() => {
    setTheme(THEMES.DARK);
    setEffectiveTheme(THEMES.DARK);
  }, []);

  /**
   * Basculer vers le mode clair
   */
  const setLightMode = useCallback(() => {
    setTheme(THEMES.LIGHT);
    setEffectiveTheme(THEMES.LIGHT);
  }, []);

  /**
   * Basculer vers le mode auto (système)
   */
  const setAutoMode = useCallback(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEMES.DARK
      : THEMES.LIGHT;
    setTheme(THEMES.AUTO);
    setEffectiveTheme(systemTheme);
  }, []);

  /**
   * Toggle entre light et dark (ne passe jamais en auto)
   */
  const toggleTheme = useCallback(() => {
    if (effectiveTheme === THEMES.LIGHT) {
      setDarkMode();
    } else {
      setLightMode();
    }
  }, [effectiveTheme, setDarkMode, setLightMode]);

  /**
   * Définir un thème spécifique
   */
  const setCustomTheme = useCallback((newTheme) => {
    if (!Object.values(THEMES).includes(newTheme)) {
      console.error('Thème invalide:', newTheme);
      return;
    }

    setTheme(newTheme);

    if (newTheme === THEMES.AUTO) {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? THEMES.DARK
        : THEMES.LIGHT;
      setEffectiveTheme(systemTheme);
    } else {
      setEffectiveTheme(newTheme);
    }
  }, []);

  return {
    // État
    theme, // 'light', 'dark', ou 'auto'
    effectiveTheme, // 'light' ou 'dark' (résolu)
    isDark: effectiveTheme === THEMES.DARK,
    isLight: effectiveTheme === THEMES.LIGHT,
    isAuto: theme === THEMES.AUTO,

    // Actions
    toggleTheme,
    setDarkMode,
    setLightMode,
    setAutoMode,
    setTheme: setCustomTheme,

    // Constantes
    THEMES,
  };
}

export default useTheme;
