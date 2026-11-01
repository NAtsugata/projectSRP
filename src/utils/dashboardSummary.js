import { localDateKey } from './workspaceTracking.js';

export const numericAmount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const euros = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
export const expensePeriod = params => ['month', '3m', '6m', 'all'].includes(params.get('period')) ? params.get('period') : '3m';
export const expenseStatus = params => ['pending', 'approved', 'paid', 'rejected'].includes(params.get('status')) ? params.get('status') : 'all';

export function expensePeriodFilters(period, now = new Date()) {
  if (period === 'all') return {};
  if (period === 'month') return {
    startDate: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
  const start = new Date(now);
  start.setMonth(start.getMonth() - (period === '6m' ? 6 : 3));
  return { startDate: localDateKey(start) };
}

export function buildDashboardSummary({ interventions = [], expenses = [], contracts = [], cerfaCount = 0, now = new Date() }) {
  const thisMonth = value => {
    if (!value) return false;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };
  const monthExpenses = expenses.filter(item => thisMonth(item.date || item.created_at));
  const pending = expenses.filter(item => item.status === 'pending');
  const monthKm = interventions.reduce((total, item) => {
    const start = item.report?.km_start;
    const end = item.report?.km_end;
    if (!item.is_archived || !thisMonth(item.archived_at || item.created_at) || start == null || end == null) return total;
    return total + Math.max(0, numericAmount(end) - numericAmount(start));
  }, 0);
  return [
    { id: 'interventions', icon: '📋', value: interventions.filter(item => thisMonth(item.created_at)).length, label: 'Interventions créées ce mois', to: '/planning', action: 'Voir le planning' },
    { id: 'expenses', icon: '💰', value: euros(monthExpenses.reduce((sum, item) => sum + numericAmount(item.amount), 0)), label: 'Dépenses de ce mois', to: '/expenses?period=month', action: 'Voir les dépenses' },
    { id: 'pending', icon: '⏳', value: pending.length, unit: pending.length === 1 ? 'note' : 'notes', label: 'En attente de validation', period: 'Toutes périodes', secondaryLabel: 'Montant à valider', secondaryValue: euros(pending.reduce((sum, item) => sum + numericAmount(item.amount), 0)), to: '/expenses?period=all&status=pending', action: 'Voir les notes en attente' },
    { id: 'contracts', icon: '📝', value: contracts.filter(item => item.status === 'active').length, label: 'Contrats actifs', to: '/contracts?status=active', action: 'Voir les contrats' },
    { id: 'cerfa', icon: '📄', value: cerfaCount, label: 'CERFA générés', to: '/cerfa', action: 'Voir les CERFA' },
    { id: 'km', icon: '🚗', value: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(monthKm), unit: 'km', label: 'Kilomètres de ce mois', to: '/archives', action: 'Voir les rapports archivés' },
  ];
}
