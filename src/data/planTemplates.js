// FILE: src/data/planTemplates.js
// Predefined templates for IR Shower plan creation

let _templateIdCounter = 1000;
const nextId = () => _templateIdCounter++;

// Helper to create elements with unique IDs
const createTemplateElements = (elements) => {
  return elements.map(el => ({ ...el, id: nextId() }));
};

export const PLAN_TEMPLATES = [
  {
    id: 'empty',
    name: 'Plan vide',
    description: 'Commencer avec une toile vierge',
    thumbnail: 'empty',
    elements: []
  },
  {
    id: 'standard',
    name: 'Douche standard',
    description: 'Salle de bain classique avec douche en coin',
    thumbnail: 'standard',
    createElements: () => createTemplateElements([
      // Room walls (rect)
      { type: 'rect', x: 80, y: 80, w: 200, h: 180 },
      // Shower base
      { type: 'rect', x: 80, y: 80, w: 100, h: 100 },
      // Dimensions
      { type: 'dim', x1: 80, y1: 280, x2: 280, y2: 280 }, // Width
      { type: 'dim', x1: 60, y1: 80, x2: 60, y2: 260 },   // Height
      { type: 'dim', x1: 80, y1: 60, x2: 180, y2: 60 },   // Shower width
      // Shower head
      { type: 'symbol', kind: 'shower', x: 130, y: 130 },
      // Mixer
      { type: 'symbol', kind: 'mixer', x: 170, y: 120 },
      // Door
      { type: 'symbol', kind: 'door', x: 220, y: 260 },
      // Bar
      { type: 'symbol', kind: 'bar', x1: 90, y1: 140, x2: 90, y2: 170 },
      // Labels
      { type: 'text', x: 150, y: 300, text: '200 cm' },
      { type: 'text', x: 20, y: 170, text: '180 cm' },
      { type: 'text', x: 115, y: 45, text: '100 cm' }
    ])
  },
  {
    id: 'compact',
    name: 'Petite salle de bain',
    description: 'Configuration compacte pour petits espaces',
    thumbnail: 'compact',
    createElements: () => createTemplateElements([
      // Small room
      { type: 'rect', x: 100, y: 80, w: 150, h: 140 },
      // Shower area
      { type: 'rect', x: 100, y: 80, w: 80, h: 80 },
      // Dimensions
      { type: 'dim', x1: 100, y1: 240, x2: 250, y2: 240 },
      { type: 'dim', x1: 80, y1: 80, x2: 80, y2: 220 },
      { type: 'dim', x1: 100, y1: 60, x2: 180, y2: 60 },
      // Equipment
      { type: 'symbol', kind: 'shower', x: 140, y: 120 },
      { type: 'symbol', kind: 'mixer', x: 165, y: 100 },
      { type: 'symbol', kind: 'door', x: 200, y: 220 },
      { type: 'symbol', kind: 'bar', x1: 110, y1: 110, x2: 110, y2: 150 },
      // Labels
      { type: 'text', x: 160, y: 260, text: '150 cm' },
      { type: 'text', x: 40, y: 150, text: '140 cm' },
      { type: 'text', x: 125, y: 45, text: '80 cm' }
    ])
  },
  {
    id: 'accessible',
    name: 'Douche PMR',
    description: 'Accessible pour personnes à mobilité réduite',
    thumbnail: 'accessible',
    createElements: () => createTemplateElements([
      // Large room
      { type: 'rect', x: 60, y: 60, w: 280, h: 220 },
      // Large shower area
      { type: 'rect', x: 60, y: 60, w: 140, h: 140 },
      // Dimensions
      { type: 'dim', x1: 60, y1: 300, x2: 340, y2: 300 },
      { type: 'dim', x1: 40, y1: 60, x2: 40, y2: 280 },
      { type: 'dim', x1: 60, y1: 40, x2: 200, y2: 40 },
      // Equipment
      { type: 'symbol', kind: 'shower', x: 130, y: 130 },
      { type: 'symbol', kind: 'mixer', x: 180, y: 100 },
      { type: 'symbol', kind: 'seat', x: 80, y: 170, orient: 'left' },
      { type: 'symbol', kind: 'door', x: 280, y: 280 },
      // Grab bars
      { type: 'symbol', kind: 'bar', x1: 70, y1: 100, x2: 70, y2: 160 },
      { type: 'symbol', kind: 'bar', x1: 100, y1: 190, x2: 180, y2: 190 },
      // Labels
      { type: 'text', x: 170, y: 320, text: '280 cm' },
      { type: 'text', x: 10, y: 170, text: '220 cm' },
      { type: 'text', x: 110, y: 25, text: '140 cm' },
      { type: 'text', x: 240, y: 150, text: 'Zone PMR' }
    ])
  },
  {
    id: 'corner',
    name: 'Douche angle',
    description: 'Douche installée dans un angle',
    thumbnail: 'corner',
    createElements: () => createTemplateElements([
      // Room
      { type: 'rect', x: 80, y: 60, w: 220, h: 200 },
      // Corner shower
      { type: 'rect', x: 80, y: 60, w: 90, h: 90 },
      // Window on wall
      { type: 'symbol', kind: 'window', x: 220, y: 60, w: 60, h: 20 },
      // Dimensions
      { type: 'dim', x1: 80, y1: 280, x2: 300, y2: 280 },
      { type: 'dim', x1: 60, y1: 60, x2: 60, y2: 260 },
      { type: 'dim', x1: 80, y1: 40, x2: 170, y2: 40 },
      // Equipment
      { type: 'symbol', kind: 'shower', x: 125, y: 105 },
      { type: 'symbol', kind: 'mixer', x: 155, y: 80 },
      { type: 'symbol', kind: 'door', x: 240, y: 260 },
      { type: 'symbol', kind: 'bar', x1: 90, y1: 100, x2: 90, y2: 140 },
      // Labels
      { type: 'text', x: 170, y: 300, text: '220 cm' },
      { type: 'text', x: 20, y: 160, text: '200 cm' },
      { type: 'text', x: 110, y: 25, text: '90 cm' }
    ])
  },
  {
    id: 'large',
    name: 'Grande douche',
    description: 'Installation spacieuse avec douche à l\'italienne',
    thumbnail: 'large',
    createElements: () => createTemplateElements([
      // Large room
      { type: 'rect', x: 50, y: 50, w: 300, h: 240 },
      // Walk-in shower area (open on one side)
      { type: 'rect', x: 50, y: 50, w: 160, h: 120 },
      // Dimensions
      { type: 'dim', x1: 50, y1: 310, x2: 350, y2: 310 },
      { type: 'dim', x1: 30, y1: 50, x2: 30, y2: 290 },
      { type: 'dim', x1: 50, y1: 30, x2: 210, y2: 30 },
      { type: 'dim', x1: 370, y1: 50, x2: 370, y2: 170 },
      // Equipment
      { type: 'symbol', kind: 'shower', x: 130, y: 100 },
      { type: 'symbol', kind: 'mixer', x: 190, y: 80 },
      { type: 'symbol', kind: 'seat', x: 70, y: 140, orient: 'left' },
      { type: 'symbol', kind: 'door', x: 290, y: 290 },
      // Multiple grab bars
      { type: 'symbol', kind: 'bar', x1: 60, y1: 80, x2: 60, y2: 130 },
      { type: 'symbol', kind: 'bar', x1: 80, y1: 160, x2: 140, y2: 160 },
      { type: 'symbol', kind: 'bar', x1: 200, y1: 90, x2: 200, y2: 150 },
      // Labels
      { type: 'text', x: 170, y: 330, text: '300 cm' },
      { type: 'text', x: 5, y: 170, text: '240 cm' },
      { type: 'text', x: 110, y: 15, text: '160 cm' },
      { type: 'text', x: 380, y: 110, text: '120 cm' }
    ])
  }
];

// Get template by ID
export const getTemplateById = (id) => {
  return PLAN_TEMPLATES.find(t => t.id === id);
};

// Get elements from template (regenerates IDs each time)
export const getTemplateElements = (templateId) => {
  const template = getTemplateById(templateId);
  if (!template) return [];
  if (template.createElements) {
    _templateIdCounter = 1000; // Reset counter for each template load
    return template.createElements();
  }
  return template.elements || [];
};
