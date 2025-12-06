// src/utils/debounce.js
// Fonction utilitaire pour debounce

/**
 * Crée une fonction debounced qui retarde l'invocation de func jusqu'à ce que
 * wait millisecondes se soient écoulées depuis le dernier appel.
 *
 * @param {Function} func - La fonction à debouncer
 * @param {number} wait - Le nombre de millisecondes à attendre
 * @param {Object} options - Options
 * @param {boolean} options.leading - Invoquer la fonction au début (default: false)
 * @param {boolean} options.trailing - Invoquer la fonction à la fin (default: true)
 * @returns {Function} La fonction debounced avec une méthode cancel
 */
export function debounce(func, wait, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeout;
  let lastCallTime;
  // eslint-disable-next-line no-unused-vars -- lastInvokeTime est utilisé pour le tracking d'état
  let lastInvokeTime = 0;
  let lastArgs;
  let lastThis;
  let result;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset l'invocation time
    lastInvokeTime = time;
    // Démarrer le timer pour le trailing edge
    timeout = setTimeout(timerExpired, wait);
    // Invoquer la fonction en leading edge si nécessaire
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeWaiting = wait - timeSinceLastCall;

    return timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;

    // Invoquer si premier appel, ou si le temps d'attente est écoulé
    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart le timer
    timeout = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeout = undefined;

    // Invoquer seulement si on a eu des appels
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeout = undefined;
  }

  function flush() {
    return timeout === undefined ? result : trailingEdge(Date.now());
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeout === undefined) {
        return leadingEdge(lastCallTime);
      }
    }
    if (timeout === undefined) {
      timeout = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}

export default debounce;
