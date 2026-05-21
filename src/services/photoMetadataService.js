// src/services/photoMetadataService.js
// Extraction des métadonnées EXIF (date, heure, GPS) depuis les photos uploadées.
// Fallback sur File.lastModified et Geolocation API si pas d'EXIF.

import exifr from 'exifr';
import logger from '../utils/logger';

/**
 * Extrait les métadonnées d'une image (date de prise, GPS).
 * Ne lève jamais : retourne { takenAt, latitude, longitude, source } ou null pour chaque champ.
 *
 * @param {File} file - Fichier image
 * @param {object} [opts]
 * @param {boolean} [opts.fallbackToFileTime=true] - Utiliser lastModified si pas d'EXIF
 * @param {object} [opts.uploadGeo=null] - Position GPS du navigateur au moment du upload, ex: {latitude, longitude}
 * @returns {Promise<{takenAt: string|null, latitude: number|null, longitude: number|null, accuracy: number|null, source: string}>}
 */
export async function extractPhotoMetadata(file, opts = {}) {
  const { fallbackToFileTime = true, uploadGeo = null } = opts;

  const result = {
    takenAt: null,
    latitude: null,
    longitude: null,
    accuracy: null,
    source: 'none',
  };

  if (!file || !file.type?.startsWith('image/')) {
    return result;
  }

  // 1) Tenter EXIF
  try {
    const exif = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTime', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude'],
      gps: true,
    });

    if (exif) {
      const dt = exif.DateTimeOriginal || exif.CreateDate || exif.DateTime;
      if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
        result.takenAt = dt.toISOString();
        result.source = 'exif';
      }
      if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        result.latitude = exif.latitude;
        result.longitude = exif.longitude;
        if (result.source === 'none') result.source = 'exif';
      }
    }
  } catch (err) {
    logger.warn('EXIF parse failed:', err?.message);
  }

  // 2) Fallback date sur lastModified
  if (!result.takenAt && fallbackToFileTime && file.lastModified) {
    const d = new Date(file.lastModified);
    if (!Number.isNaN(d.getTime())) {
      result.takenAt = d.toISOString();
      result.source = result.source === 'none' ? 'file-time' : result.source;
    }
  }

  // 3) Fallback GPS sur la position du navigateur au moment du upload
  if ((result.latitude == null || result.longitude == null) && uploadGeo) {
    if (typeof uploadGeo.latitude === 'number' && typeof uploadGeo.longitude === 'number') {
      result.latitude = uploadGeo.latitude;
      result.longitude = uploadGeo.longitude;
      result.accuracy = uploadGeo.accuracy ?? null;
      if (result.source === 'none') result.source = 'upload-geo';
    }
  }

  return result;
}

/**
 * Tente de récupérer la position GPS du navigateur (best-effort, ne bloque pas).
 * @returns {Promise<{latitude, longitude, accuracy}|null>}
 */
export function getBrowserGeolocation(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(null); }
    }, timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
      );
    } catch {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
    }
  });
}

/**
 * Formate les métadonnées pour l'affichage.
 */
export function formatMetadata(meta) {
  if (!meta) return null;
  const parts = {};
  if (meta.takenAt) {
    const d = new Date(meta.takenAt);
    if (!Number.isNaN(d.getTime())) {
      parts.date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      parts.time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  if (typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
    parts.coords = `${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)}`;
    parts.mapsUrl = `https://www.google.com/maps?q=${meta.latitude},${meta.longitude}`;
  }
  parts.source = meta.source || 'none';
  return parts;
}
