// src/lib/planElements.js
// Catalogue des éléments du plan (douche, WC, lavabo, etc.)
// Chaque type définit ses dimensions par défaut, son icône 2D et sa représentation 3D.

/**
 * Catégories pour la palette de l'éditeur.
 */
export const ELEMENT_CATEGORIES = [
  { id: 'shower',   label: 'Douche',     icon: '🚿' },
  { id: 'sanitary', label: 'Sanitaires', icon: '🚽' },
  { id: 'opening',  label: 'Ouvertures', icon: '🚪' },
  { id: 'furniture',label: 'Mobilier',   icon: '🪑' },
];

/**
 * Catalogue des éléments.
 * - defaultWidth/defaultDepth/defaultHeight : dimensions par défaut en cm
 * - color : couleur 2D et 3D
 * - shape : 'box' | 'cylinder' (forme 3D primitive)
 * - svgIcon : SVG inline pour la palette
 */
export const ELEMENT_CATALOG = {
  // ── Douche ──────────────────────────────────────────────
  shower_base: {
    label: 'Receveur',
    category: 'shower',
    defaultWidth: 90, defaultDepth: 90, defaultHeight: 5,
    color: '#a3d4e8',
    shape: 'box',
    icon: '⬜',
  },
  shower_glass: {
    label: 'Paroi vitrée',
    category: 'shower',
    defaultWidth: 90, defaultDepth: 2, defaultHeight: 200,
    color: '#bae6fd',
    opacity: 0.4,
    shape: 'box',
    icon: '▮',
  },
  shower_head: {
    label: 'Pommeau',
    category: 'shower',
    defaultWidth: 25, defaultDepth: 8, defaultHeight: 8,
    color: '#9ca3af',
    shape: 'cylinder',
    icon: '🚿',
    mountHeight: 200, // hauteur de fixation en cm
  },
  shower_mixer: {
    label: 'Mitigeur',
    category: 'shower',
    defaultWidth: 15, defaultDepth: 8, defaultHeight: 25,
    color: '#737373',
    shape: 'box',
    icon: '🔧',
    mountHeight: 110,
  },
  shower_bar: {
    label: 'Barre PMR',
    category: 'shower',
    defaultWidth: 60, defaultDepth: 4, defaultHeight: 4,
    color: '#d1d5db',
    shape: 'cylinder',
    icon: '━',
    mountHeight: 80,
  },
  shower_seat: {
    label: 'Siège',
    category: 'shower',
    defaultWidth: 40, defaultDepth: 35, defaultHeight: 45,
    color: '#e5e7eb',
    shape: 'box',
    icon: '🪑',
  },
  drain: {
    label: 'Bonde de sol',
    category: 'shower',
    defaultWidth: 15, defaultDepth: 15, defaultHeight: 1,
    color: '#71717a',
    shape: 'cylinder',
    icon: '◯',
  },

  // ── Sanitaires ──────────────────────────────────────────
  wc: {
    label: 'WC',
    category: 'sanitary',
    defaultWidth: 40, defaultDepth: 65, defaultHeight: 80,
    color: '#f3f4f6',
    shape: 'box',
    icon: '🚽',
  },
  sink: {
    label: 'Lavabo',
    category: 'sanitary',
    defaultWidth: 60, defaultDepth: 45, defaultHeight: 85,
    color: '#f9fafb',
    shape: 'box',
    icon: '🪣',
  },
  bathtub: {
    label: 'Baignoire',
    category: 'sanitary',
    defaultWidth: 170, defaultDepth: 70, defaultHeight: 55,
    color: '#e0f2fe',
    shape: 'box',
    icon: '🛁',
  },
  bidet: {
    label: 'Bidet',
    category: 'sanitary',
    defaultWidth: 35, defaultDepth: 55, defaultHeight: 40,
    color: '#f3f4f6',
    shape: 'box',
    icon: '🧴',
  },

  // ── Ouvertures ──────────────────────────────────────────
  door: {
    label: 'Porte',
    category: 'opening',
    defaultWidth: 80, defaultDepth: 8, defaultHeight: 210,
    color: '#92400e',
    shape: 'box',
    icon: '🚪',
    isOpening: true,
  },
  window: {
    label: 'Fenêtre',
    category: 'opening',
    defaultWidth: 80, defaultDepth: 8, defaultHeight: 100,
    color: '#bfdbfe',
    opacity: 0.5,
    shape: 'box',
    icon: '🪟',
    mountHeight: 90,
    isOpening: true,
  },

  // ── Mobilier ────────────────────────────────────────────
  mirror: {
    label: 'Miroir',
    category: 'furniture',
    defaultWidth: 80, defaultDepth: 3, defaultHeight: 60,
    color: '#cbd5e1',
    shape: 'box',
    icon: '🪞',
    mountHeight: 100,
  },
  cabinet: {
    label: 'Meuble',
    category: 'furniture',
    defaultWidth: 80, defaultDepth: 45, defaultHeight: 80,
    color: '#a16207',
    shape: 'box',
    icon: '📦',
  },
  radiator: {
    label: 'Radiateur',
    category: 'furniture',
    defaultWidth: 60, defaultDepth: 10, defaultHeight: 80,
    color: '#fca5a5',
    shape: 'box',
    icon: '♨️',
  },
  towel_rail: {
    label: 'Sèche-serviette',
    category: 'furniture',
    defaultWidth: 50, defaultDepth: 6, defaultHeight: 120,
    color: '#fde68a',
    shape: 'box',
    icon: '🧖',
    mountHeight: 30,
  },
};

/**
 * Liste tous les types par catégorie pour l'affichage en palette.
 */
export function getElementsByCategory() {
  const out = {};
  for (const cat of ELEMENT_CATEGORIES) out[cat.id] = [];
  for (const [type, def] of Object.entries(ELEMENT_CATALOG)) {
    if (out[def.category]) out[def.category].push({ type, ...def });
  }
  return out;
}
