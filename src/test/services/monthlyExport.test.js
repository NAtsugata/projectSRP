// Tests pour les fonctions utilitaires de monthlyExportService
import { describe, it, expect } from 'vitest';

// On teste la logique de zone directement (fonction pure extraite)
const ZONE_THRESHOLDS = [
  { maxKm: 10, label: 'Zone 1 (0-10 km)' },
  { maxKm: 20, label: 'Zone 2 (10-20 km)' },
  { maxKm: 30, label: 'Zone 3 (20-30 km)' },
  { maxKm: 50, label: 'Zone 4 (30-50 km)' },
  { maxKm: Infinity, label: 'Zone 5 (50+ km)' },
];

function getZone(distanceKm) {
  for (const z of ZONE_THRESHOLDS) {
    if (distanceKm <= z.maxKm) return z.label;
  }
  return ZONE_THRESHOLDS[ZONE_THRESHOLDS.length - 1].label;
}

// Logique de filtrage des dépenses payées (reproduite du service)
function filterUnpaidExpenses(expenses, userId) {
  return expenses.filter(e =>
    e.user_id === userId &&
    e.status?.toLowerCase() !== 'payée' &&
    e.status?.toLowerCase() !== 'payé'
  );
}

describe('getZone', () => {
  it('retourne Zone 1 pour 0-10 km', () => {
    expect(getZone(0)).toBe('Zone 1 (0-10 km)');
    expect(getZone(5)).toBe('Zone 1 (0-10 km)');
    expect(getZone(10)).toBe('Zone 1 (0-10 km)');
  });

  it('retourne Zone 2 pour 10-20 km', () => {
    expect(getZone(11)).toBe('Zone 2 (10-20 km)');
    expect(getZone(20)).toBe('Zone 2 (10-20 km)');
  });

  it('retourne Zone 3 pour 20-30 km', () => {
    expect(getZone(25)).toBe('Zone 3 (20-30 km)');
  });

  it('retourne Zone 4 pour 30-50 km', () => {
    expect(getZone(45)).toBe('Zone 4 (30-50 km)');
  });

  it('retourne Zone 5 pour 50+ km', () => {
    expect(getZone(100)).toBe('Zone 5 (50+ km)');
    expect(getZone(999)).toBe('Zone 5 (50+ km)');
  });
});

describe('filterUnpaidExpenses', () => {
  const userId = 'user-1';
  const expenses = [
    { id: 1, user_id: 'user-1', status: 'En attente', amount: 50 },
    { id: 2, user_id: 'user-1', status: 'payée', amount: 100 },
    { id: 3, user_id: 'user-1', status: 'Payé', amount: 75 },
    { id: 4, user_id: 'user-1', status: 'approuvée', amount: 200 },
    { id: 5, user_id: 'user-2', status: 'En attente', amount: 30 },
    { id: 6, user_id: 'user-1', status: null, amount: 25 },
  ];

  it('exclut les dépenses payées (payée/payé insensible à la casse)', () => {
    const result = filterUnpaidExpenses(expenses, userId);
    expect(result).toHaveLength(3);
    expect(result.map(e => e.id)).toEqual([1, 4, 6]);
  });

  it('exclut les dépenses d\'autres utilisateurs', () => {
    const result = filterUnpaidExpenses(expenses, userId);
    expect(result.every(e => e.user_id === userId)).toBe(true);
  });

  it('inclut les dépenses sans statut', () => {
    const result = filterUnpaidExpenses(expenses, userId);
    expect(result.find(e => e.id === 6)).toBeDefined();
  });

  it('retourne un tableau vide si aucune dépense ne correspond', () => {
    const result = filterUnpaidExpenses(expenses, 'user-unknown');
    expect(result).toHaveLength(0);
  });
});

describe('filtrage interventions par mois', () => {
  function filterInterventionsByMonth(interventions, year, month) {
    return interventions.filter(iv => {
      if (iv.scheduled_dates && Array.isArray(iv.scheduled_dates)) {
        return iv.scheduled_dates.some(d => {
          const date = new Date(d);
          return date.getFullYear() === year && (date.getMonth() + 1) === month;
        });
      }
      if (iv.date) {
        const date = new Date(iv.date);
        return date.getFullYear() === year && (date.getMonth() + 1) === month;
      }
      return false;
    });
  }

  it('filtre par scheduled_dates', () => {
    const interventions = [
      { id: 1, scheduled_dates: ['2026-02-15', '2026-02-16'] },
      { id: 2, scheduled_dates: ['2026-03-01'] },
      { id: 3, scheduled_dates: ['2026-01-31', '2026-02-01'] },
    ];
    const result = filterInterventionsByMonth(interventions, 2026, 2);
    expect(result.map(i => i.id)).toEqual([1, 3]);
  });

  it('fallback sur le champ date si pas de scheduled_dates', () => {
    const interventions = [
      { id: 1, date: '2026-02-10' },
      { id: 2, date: '2026-03-10' },
    ];
    const result = filterInterventionsByMonth(interventions, 2026, 2);
    expect(result.map(i => i.id)).toEqual([1]);
  });

  it('exclut les interventions sans date', () => {
    const interventions = [{ id: 1 }];
    const result = filterInterventionsByMonth(interventions, 2026, 2);
    expect(result).toHaveLength(0);
  });
});
