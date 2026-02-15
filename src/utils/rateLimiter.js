// src/utils/rateLimiter.js
// Rate limiter côté client pour protéger contre les appels excessifs
// Utilise un token bucket algorithm simple et efficace

/**
 * Crée un rate limiter avec token bucket
 * @param {number} maxTokens - Nombre max de requêtes dans la fenêtre
 * @param {number} refillRate - Tokens regagnés par seconde
 * @returns {{ canProceed: () => boolean, waitForToken: () => Promise<void> }}
 */
export function createRateLimiter(maxTokens = 30, refillRate = 5) {
  let tokens = maxTokens;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
    lastRefill = now;
  }

  return {
    canProceed() {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return true;
      }
      return false;
    },

    async waitForToken() {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      // Attendre le temps nécessaire pour 1 token
      const waitMs = ((1 - tokens) / refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.ceil(waitMs)));
      tokens = 0;
      lastRefill = Date.now();
    },

    /** Nombre de tokens restants (arrondi) */
    get remaining() {
      refill();
      return Math.floor(tokens);
    }
  };
}

/**
 * Rate limiter par action (login, signup, etc.)
 * Empêche le brute force sur les actions sensibles
 */
export function createActionLimiter(maxAttempts = 5, windowMs = 60000) {
  const attempts = new Map();

  return {
    /**
     * @param {string} key - Identifiant de l'action (ex: 'login', 'signup')
     * @returns {{ allowed: boolean, retryAfterMs: number }}
     */
    check(key) {
      const now = Date.now();
      const record = attempts.get(key);

      if (!record || now - record.firstAttempt > windowMs) {
        attempts.set(key, { count: 1, firstAttempt: now });
        return { allowed: true, retryAfterMs: 0 };
      }

      if (record.count >= maxAttempts) {
        const retryAfterMs = windowMs - (now - record.firstAttempt);
        return { allowed: false, retryAfterMs };
      }

      record.count++;
      return { allowed: true, retryAfterMs: 0 };
    },

    reset(key) {
      attempts.delete(key);
    }
  };
}

// Rate limiter global pour les requêtes Supabase (30 req/s, recharge 5/s)
export const supabaseRateLimiter = createRateLimiter(30, 5);

// Rate limiter pour les actions d'authentification (5 tentatives / 60s)
export const authRateLimiter = createActionLimiter(5, 60000);
