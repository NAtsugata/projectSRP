// src/utils/logger.js - Système de logging avec monitoring intégré
// En production, seules les erreurs sont loggées + collectées pour analytics
// En développement, tous les logs sont affichés

const isDevelopment = process.env.NODE_ENV === 'development';

// Storage pour analytics
const errorStore = [];
const metricsStore = [];
const MAX_ERRORS = 50;
const MAX_METRICS = 20;

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args) => {
    // Les erreurs sont toujours loggées (nécessaires pour le monitoring)
    console.error(...args);
    // Collecter les erreurs pour analytics
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };
    errorStore.push(errorEntry);
    if (errorStore.length > MAX_ERRORS) errorStore.shift();
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // Fonction spéciale pour les logs avec emoji (style du code actuel)
  emoji: (emoji, message, ...rest) => {
    if (isDevelopment) {
      console.log(`${emoji} ${message}`, ...rest);
    }
  },

  // 📊 ANALYTICS - Track performance metrics
  trackMetric: (name, value, unit = 'ms') => {
    const metric = { name, value, unit, timestamp: Date.now() };
    metricsStore.push(metric);
    if (metricsStore.length > MAX_METRICS) metricsStore.shift();
    if (isDevelopment) {
      console.log(`📊 Metric: ${name} = ${value}${unit}`);
    }
  },

  // ⏱️ PERFORMANCE - Start timing
  startTimer: (label) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`);
    }
    return Date.now();
  },

  // ⏱️ PERFORMANCE - End timing and log
  endTimer: (label, startTime) => {
    const duration = Date.now() - startTime;
    logger.trackMetric(label, duration);
    return duration;
  },

  // 📤 UPLOAD - Track upload diagnostics
  trackUpload: (fileName, status, details = {}) => {
    const entry = {
      type: 'upload',
      fileName,
      status, // 'start', 'success', 'error', 'retry'
      ...details,
      timestamp: Date.now(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connection: typeof navigator !== 'undefined' && navigator.connection
        ? navigator.connection.effectiveType : 'unknown'
    };
    if (status === 'error') {
      errorStore.push({ ...entry, message: `Upload failed: ${fileName}` });
      if (errorStore.length > MAX_ERRORS) errorStore.shift();
    }
    if (isDevelopment) {
      console.log(`📤 Upload [${status}]: ${fileName}`, details);
    }
  },

  // 📈 Get collected errors (for future remote reporting)
  getErrors: () => [...errorStore],

  // 📈 Get collected metrics (for future remote reporting)
  getMetrics: () => [...metricsStore],

  // 🔍 Get diagnostics summary
  getDiagnostics: () => ({
    errors: errorStore.length,
    lastError: errorStore[errorStore.length - 1] || null,
    metrics: metricsStore.slice(-5),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    memory: typeof performance !== 'undefined' && performance.memory
      ? { used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' }
      : null
  })
};

export default logger;

