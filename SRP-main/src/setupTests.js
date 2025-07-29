// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ✅ CORRIGÉ: Ajout de variables d'environnement factices pour les tests.
// Cela permet à l'application de s'initialiser sans erreur pendant les tests,
// car Jest n'a pas accès aux vraies clés du fichier .env.
process.env.REACT_APP_SUPABASE_URL = 'https://hvswbkbwomvwhnqglmbe.supabase.co';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2c3dia2J3b212d2hucWdsbWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NzIzMjMsImV4cCI6MjA2ODQ0ODMyM30.kvACwanG8mglfxupz5_MaPaUACRywGLIjVPmWikAV0M';

// ✅ NOUVEAU: Configuration globale pour les tests mobiles
// Mock des APIs Web modernes qui peuvent ne pas être disponibles dans l'environnement de test

// Mock de ResizeObserver pour les tests responsifs
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock de IntersectionObserver pour les tests de visibilité
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ✅ NOUVEAU: Mock des APIs de géolocalisation pour les tests
global.navigator.geolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// ✅ NOUVEAU: Mock de l'API File pour les tests d'upload
global.File = class MockFile {
  constructor(parts, filename, properties) {
    this.parts = parts;
    this.name = filename;
    this.size = properties?.size || 0;
    this.type = properties?.type || '';
    this.lastModified = properties?.lastModified || Date.now();
  }
};

// ✅ NOUVEAU: Mock de FileReader pour les tests de lecture de fichiers
global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
  }

  readAsDataURL(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = 'data:image/png;base64,mockbase64data';
      if (this.onload) this.onload();
    }, 0);
  }

  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = 'mock file content';
      if (this.onload) this.onload();
    }, 0);
  }
};

// ✅ NOUVEAU: Mock du Canvas API pour les tests de signature
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
}));

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockcanvasdata');
HTMLCanvasElement.prototype.toBlob = jest.fn((callback) => callback(new Blob()));

// ✅ NOUVEAU: Mock de l'API Clipboard pour les tests de copie/collage
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue([]),
  },
});

// ✅ NOUVEAU: Mock des événements tactiles pour les tests mobile
window.TouchEvent = class MockTouchEvent extends Event {
  constructor(type, options = {}) {
    super(type, options);
    this.touches = options.touches || [];
    this.targetTouches = options.targetTouches || [];
    this.changedTouches = options.changedTouches || [];
  }
};

// ✅ NOUVEAU: Mock de l'API Vibration pour les tests mobile
navigator.vibrate = jest.fn();

// ✅ NOUVEAU: Mock de l'API Screen Orientation pour les tests responsifs
Object.defineProperty(screen, 'orientation', {
  value: {
    angle: 0,
    type: 'portrait-primary',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

// ✅ NOUVEAU: Mock des propriétés CSS personnalisées pour les tests
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: (prop) => '',
    setProperty: jest.fn(),
  }),
});

// ✅ NOUVEAU: Mock de requestAnimationFrame pour les tests d'animation
global.requestAnimationFrame = jest.fn((callback) => setTimeout(callback, 16));
global.cancelAnimationFrame = jest.fn();

// ✅ NOUVEAU: Mock de l'API Web Share pour les tests de partage mobile
navigator.share = jest.fn().mockResolvedValue(undefined);
navigator.canShare = jest.fn().mockReturnValue(true);

// ✅ NOUVEAU: Configuration pour éviter les warnings React lors des tests
const originalError = console.error;
beforeEach(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalError;
});

// ✅ NOUVEAU: Mock du matchMedia pour les tests de media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// ✅ NOUVEAU: Configuration globale des timeouts pour les tests async
jest.setTimeout(10000); // 10 secondes pour les tests qui impliquent des appels réseau

// ✅ NOUVEAU: Mock de l'API Notification pour les tests
global.Notification = class MockNotification {
  constructor(title, options) {
    this.title = title;
    this.options = options;
  }

  static requestPermission = jest.fn().mockResolvedValue('granted');
  static permission = 'granted';
};

// ✅ NOUVEAU: Mock de l'API ServiceWorker pour les tests PWA
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: jest.fn().mockResolvedValue({
      update: jest.fn(),
      unregister: jest.fn().mockResolvedValue(true),
    }),
    ready: jest.fn().mockResolvedValue({
      update: jest.fn(),
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

// ✅ NOUVEAU: Mock de l'API de cache pour les tests offline
global.caches = {
  open: jest.fn().mockResolvedValue({
    match: jest.fn(),
    add: jest.fn(),
    addAll: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  }),
  match: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  keys: jest.fn().mockResolvedValue([]),
};