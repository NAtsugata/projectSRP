import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'app-theme';
const CHANGE_EVENT = 'srp-theme-change';
const THEMES = { LIGHT: 'light', DARK: 'dark', AUTO: 'auto' };
let fallbackTheme = THEMES.LIGHT;
function getTheme() {
  try { const saved = localStorage.getItem(STORAGE_KEY); return Object.values(THEMES).includes(saved) ? saved : fallbackTheme; }
  catch { return fallbackTheme; }
}
function subscribeTheme(callback) {
  const onStorage = event => { if (event.key === STORAGE_KEY || event.key === null) callback(); };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(CHANGE_EVENT, callback); window.removeEventListener('storage', onStorage); };
}
function subscribeSystem(callback) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const getSystemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => THEMES.LIGHT);
  const systemDark = useSyncExternalStore(subscribeSystem, getSystemDark, () => false);
  const effectiveTheme = theme === THEMES.AUTO ? (systemDark ? THEMES.DARK : THEMES.LIGHT) : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark-theme', effectiveTheme === THEMES.DARK);
    root.classList.toggle('light-theme', effectiveTheme === THEMES.LIGHT);
    root.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);
  const setCustomTheme = useCallback(value => {
    if (!Object.values(THEMES).includes(value)) return;
    fallbackTheme = value;
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Theme remains available for this session. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const setDarkMode = useCallback(() => setCustomTheme(THEMES.DARK), [setCustomTheme]);
  const setLightMode = useCallback(() => setCustomTheme(THEMES.LIGHT), [setCustomTheme]);
  const setAutoMode = useCallback(() => setCustomTheme(THEMES.AUTO), [setCustomTheme]);
  const toggleTheme = useCallback(() => setCustomTheme(effectiveTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK), [effectiveTheme, setCustomTheme]);
  return { theme, effectiveTheme, isDark: effectiveTheme === THEMES.DARK, isLight: effectiveTheme === THEMES.LIGHT,
    isAuto: theme === THEMES.AUTO, toggleTheme, setDarkMode, setLightMode, setAutoMode, setTheme: setCustomTheme, THEMES };
}
export default useTheme;
