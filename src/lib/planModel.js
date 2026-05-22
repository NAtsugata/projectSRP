// src/lib/planModel.js
// Modèle de données partagé entre l'éditeur 2D et le viewer 3D.
// Toutes les dimensions sont en centimètres.

import { ELEMENT_CATALOG } from './planElements';

let _idCounter = 1;
export const genId = () => `el_${Date.now()}_${_idCounter++}`;

/**
 * Plan vide par défaut
 */
export function createEmptyPlan() {
  return {
    version: 1,
    room: {
      width: 300,   // largeur en cm (axe X)
      depth: 250,   // profondeur en cm (axe Z, "Y" en vue de dessus)
      height: 250,  // hauteur en cm (axe Y vertical, ignoré en 2D)
    },
    elements: [],
  };
}

/**
 * Crée un nouvel élément à partir de son type, en piochant les valeurs par défaut du catalogue.
 */
export function createElement(type, overrides = {}) {
  const def = ELEMENT_CATALOG[type];
  if (!def) throw new Error(`Type d'élément inconnu: ${type}`);
  return {
    id: genId(),
    type,
    x: 50,
    y: 50,
    width: def.defaultWidth,
    depth: def.defaultDepth,
    height: def.defaultHeight,
    rotation: 0,
    ...overrides,
  };
}

/**
 * Garantit qu'un plan est conforme et sain (utile au chargement depuis BDD).
 */
// Bornes physiques (cm) — partagées entre éditeur 2D et viewer 3D
export const ROOM_LIMITS = {
  width:  { min: 50,  max: 2000 },
  depth:  { min: 50,  max: 2000 },
  height: { min: 150, max: 500  },
};

const clampNum = (val, fallback, min, max) => {
  const n = Number(val);
  if (!isFinite(n) || n <= 0) return fallback;
  return Math.max(min, Math.min(max, n));
};

export function normalizePlan(input) {
  if (!input || typeof input !== 'object') return createEmptyPlan();
  const base = createEmptyPlan();
  const out = {
    version: 1,
    room: {
      width:  clampNum(input.room?.width,  base.room.width,  ROOM_LIMITS.width.min,  ROOM_LIMITS.width.max),
      depth:  clampNum(input.room?.depth,  base.room.depth,  ROOM_LIMITS.depth.min,  ROOM_LIMITS.depth.max),
      height: clampNum(input.room?.height, base.room.height, ROOM_LIMITS.height.min, ROOM_LIMITS.height.max),
    },
    elements: Array.isArray(input.elements) ? input.elements
      .filter(e => e && ELEMENT_CATALOG[e.type])
      .map(e => {
        const def = ELEMENT_CATALOG[e.type];
        return {
          id: e.id || genId(),
          type: e.type,
          x: Number(e.x) || 0,
          y: Number(e.y) || 0,
          width:  Math.max(1, Number(e.width)  || def.defaultWidth),
          depth:  Math.max(1, Number(e.depth)  || def.defaultDepth),
          height: Math.max(1, Number(e.height) || def.defaultHeight),
          rotation: ((Number(e.rotation) || 0) % 360 + 360) % 360,
        };
      }) : [],
  };
  return out;
}

/**
 * Aligne une valeur sur la grille.
 */
export function snap(value, gridSize = 10) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Contraint un élément à rester dans la pièce.
 */
export function clampToRoom(element, room) {
  const half = element.rotation % 180 === 0;
  const w = half ? element.width : element.depth;
  const d = half ? element.depth : element.width;
  return {
    ...element,
    x: Math.max(0, Math.min(room.width - w, element.x)),
    y: Math.max(0, Math.min(room.depth - d, element.y)),
  };
}
