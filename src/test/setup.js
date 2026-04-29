// src/test/setup.js
import '@testing-library/jest-dom';

// Mock localStorage / sessionStorage
const storageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
  };
};

Object.defineProperty(globalThis, 'localStorage', { value: storageMock() });
Object.defineProperty(globalThis, 'sessionStorage', { value: storageMock() });

// Mock navigator.onLine
Object.defineProperty(globalThis.navigator, 'onLine', {
  value: true,
  writable: true,
});

// Mock window.matchMedia
globalThis.matchMedia = globalThis.matchMedia || function () {
  return { matches: false, addListener: () => {}, removeListener: () => {} };
};

// Suppress console.warn/error in tests unless debugging
if (!import.meta.env.VITE_DEBUG_TESTS) {
  const noop = () => {};
  globalThis.console.warn = noop;
}
