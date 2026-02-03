// src/utils/geocoding.js
// Service de géocodage et calcul de distance
// Utilise Nominatim (OpenStreetMap) + Haversine + facteur route

import logger from './logger';

// Coordonnées du siège : 422 route de Digne, 04660 Champtercier
const COMPANY_HQ_COORDS = { lat: 44.0556, lng: 6.0681 };

// Facteur de correction route (distance vol d'oiseau → distance route)
// 1.35 pour zone montagneuse (Alpes-de-Haute-Provence)
const ROAD_FACTOR = 1.35;

// Cache localStorage pour éviter les appels API répétés
const CACHE_KEY = 'srp_geocode_cache';

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage plein — ignorer
  }
}

/**
 * Distance Haversine entre deux points (km)
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // rayon Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Normalise une adresse pour la clé de cache
 */
function normalizeAddress(address) {
  return (address || '')
    .toLowerCase()
    .replace(/[,.\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pause de n ms (pour respecter le rate limit Nominatim : 1 req/sec)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Géocode une adresse via Nominatim (OpenStreetMap)
 * Retourne { lat, lng } ou null
 */
async function geocodeAddress(address) {
  if (!address || address.trim().length < 5) return null;

  const normalized = normalizeAddress(address);
  const cache = getCache();

  // Vérifier le cache
  if (cache[normalized]) {
    return cache[normalized];
  }

  try {
    const query = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=fr&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SRP-BTP-App/1.0',
        'Accept-Language': 'fr',
      },
    });

    if (!response.ok) {
      logger.error('Geocoding HTTP error:', response.status);
      return null;
    }

    const results = await response.json();

    if (results && results.length > 0) {
      const coords = {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };

      // Sauvegarder en cache
      cache[normalized] = coords;
      setCache(cache);

      return coords;
    }

    // Pas de résultat — mettre null en cache pour ne pas re-tenter
    cache[normalized] = null;
    setCache(cache);
    return null;
  } catch (error) {
    logger.error('Geocoding error for:', address, error);
    return null;
  }
}

/**
 * Calcule la distance aller (km route estimée) entre le siège et une adresse
 * @param {string} address - Adresse du chantier
 * @returns {Promise<number|null>} Distance en km ou null si impossible
 */
export async function getDistanceFromHQ(address) {
  const coords = await geocodeAddress(address);
  if (!coords) return null;

  const straightLine = haversineKm(
    COMPANY_HQ_COORDS.lat, COMPANY_HQ_COORDS.lng,
    coords.lat, coords.lng
  );

  // Appliquer le facteur route et arrondir
  return Math.round(straightLine * ROAD_FACTOR);
}

/**
 * Calcule les distances pour un tableau d'adresses (avec rate limiting)
 * @param {string[]} addresses - Liste d'adresses uniques
 * @returns {Promise<Object>} Map { address: distanceKm }
 */
export async function batchGetDistances(addresses) {
  const results = {};
  const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
  const cache = getCache();

  for (let i = 0; i < uniqueAddresses.length; i++) {
    const address = uniqueAddresses[i];
    const normalized = normalizeAddress(address);

    // Si déjà en cache, pas besoin d'appel API
    if (cache[normalized] !== undefined) {
      if (cache[normalized]) {
        const straight = haversineKm(
          COMPANY_HQ_COORDS.lat, COMPANY_HQ_COORDS.lng,
          cache[normalized].lat, cache[normalized].lng
        );
        results[address] = Math.round(straight * ROAD_FACTOR);
      } else {
        results[address] = null;
      }
      continue;
    }

    // Appel API avec rate limiting (1 req/sec pour Nominatim)
    if (i > 0) await sleep(1100);

    const distance = await getDistanceFromHQ(address);
    results[address] = distance;
  }

  return results;
}

/**
 * Vide le cache de géocodage
 */
export function clearGeoCache() {
  localStorage.removeItem(CACHE_KEY);
}

export { COMPANY_HQ_COORDS, ROAD_FACTOR };
