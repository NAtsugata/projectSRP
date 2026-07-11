// src/config/chantierPresets.js
// Lots prédéfinis (corps de métier standards) pour créer un gros chantier
// rapidement, et catégories de documents MOE.

// Corps de métier les plus courants (ordre logique du chantier)
export const PRESET_LOTS = [
  'Terrassement / VRD',
  'Gros œuvre',
  'Charpente',
  'Couverture',
  'Étanchéité',
  'Menuiseries extérieures',
  'Plâtrerie / Isolation',
  'Plomberie / Sanitaire',
  'Chauffage / Ventilation',
  'Électricité',
  'Menuiseries intérieures',
  'Carrelage / Faïence',
  'Peinture',
  'Sols souples',
  'Serrurerie / Métallerie',
  'Ascenseur',
  'Espaces verts',
  'Nettoyage',
];

// Catégories de documents déposés par le MOE
export const DOC_CATEGORIES = [
  { key: 'plan', label: 'Plan' },
  { key: 'plan_execution', label: "Plan d'exécution" },
  { key: 'cctp', label: 'CCTP' },
  { key: 'dpgf', label: 'DPGF / Devis' },
  { key: 'permis', label: 'Permis / Autorisation' },
  { key: 'planning', label: 'Planning' },
  { key: 'autre', label: 'Autre' },
];

export const DOC_CATEGORY_LABEL = DOC_CATEGORIES.reduce((a, c) => { a[c.key] = c.label; return a; }, {});

// Limites d'upload — messages clairs plutôt que blocage silencieux.
export const MAX_DOC_MB = 50;
export const MAX_PHOTO_MB = 25;
export const ALLOWED_DOC_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'dwg', 'dxf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'zip', 'txt', 'csv',
];

/**
 * Valide un fichier avant envoi. Retourne null si OK, sinon un message
 * d'erreur en français prêt à afficher.
 */
export function validateChantierFile(file, { maxMb, extensions = null } = {}) {
  if (!file) return 'Aucun fichier sélectionné.';
  const sizeMb = file.size / (1024 * 1024);
  if (maxMb && sizeMb > maxMb) {
    return `Fichier trop volumineux (${sizeMb.toFixed(1)} Mo). Maximum autorisé : ${maxMb} Mo.`;
  }
  if (extensions) {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    if (!extensions.includes(ext)) {
      return `Format « .${ext || '?'} » non accepté. Formats autorisés : PDF, Word, Excel, images, DWG, ZIP.`;
    }
  }
  return null;
}
