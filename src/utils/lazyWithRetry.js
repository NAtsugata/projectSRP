// src/utils/lazyWithRetry.js
// Chargement paresseux résistant aux deux causes courantes de
// « Failed to fetch dynamically imported module » :
//   1. coupure réseau passagère (mobile) → on réessaie ;
//   2. index.html périmé après un déploiement (le fichier haché n'existe
//      plus) → on recharge la page une seule fois pour obtenir la nouvelle
//      version.

import { lazy } from 'react';

const RELOAD_FLAG = 'srp_chunk_reload';

export const isChunkLoadError = (error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|Failed to fetch/i
    .test(error?.message || String(error || ''));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readFlag = () => { try { return sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { return false; } };
const writeFlag = (on) => { try { on ? sessionStorage.setItem(RELOAD_FLAG, '1') : sessionStorage.removeItem(RELOAD_FLAG); } catch { /* stockage indisponible */ } };

/**
 * Recharge la page une seule fois pour récupérer une version fraîche.
 * @returns {boolean} true si un rechargement a été déclenché
 */
export const reloadOnceForFreshBuild = () => {
  if (readFlag() || typeof window === 'undefined' || navigator.onLine === false) return false;
  writeFlag(true);
  window.location.reload();
  return true;
};

export function lazyWithRetry(importer, { retries = 2, delayMs = 700 } = {}) {
  return lazy(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await importer();
        writeFlag(false); // chargement sain : un futur déploiement pourra à nouveau recharger
        return mod;
      } catch (error) {
        lastError = error;
        if (!isChunkLoadError(error)) throw error;
        if (attempt < retries) await wait(delayMs * (attempt + 1));
      }
    }
    if (reloadOnceForFreshBuild()) {
      return new Promise(() => {}); // la page se recharge, on n'affiche rien d'autre
    }
    throw lastError;
  });
}

export default lazyWithRetry;
