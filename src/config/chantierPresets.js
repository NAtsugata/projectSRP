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
