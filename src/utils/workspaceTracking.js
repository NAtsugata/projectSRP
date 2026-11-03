// Presentation helpers only: no persisted records or business statuses are changed.
export function localDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function normalizeSearch(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim();
}
export function interventionDate(intervention, today = localDateKey()) {
  const dates = [...new Set([...(intervention.scheduled_dates || []), intervention.date].filter(Boolean))].sort();
  return dates.find(date => date >= today) || dates.at(-1) || '';
}
export function isUrgentIntervention(intervention) {
  return intervention.additional_needs?.some(need => need.isUrgent) || false;
}
export function upcomingInterventions(interventions, focus = 'upcoming', today = localDateKey()) {
  return interventions.filter(item => {
    if (item.is_archived || item.status === 'Terminée') return false;
    const dates = [...(item.scheduled_dates || []), item.date];
    if (focus === 'today') return dates.includes(today);
    if (focus === 'urgent') return isUrgentIntervention(item);
    return dates.some(date => date >= today) || item.report?.arrivalTime || item.status === 'En cours';
  }).sort((a, b) => {
    const dateA = interventionDate(a, today) || '9999';
    const dateB = interventionDate(b, today) || '9999';
    return dateA.localeCompare(dateB) || (a.time || '').localeCompare(b.time || '');
  });
}
export function chantierProgress(lots = []) {
  if (!lots.length) return 0;
  return Math.round(lots.reduce((sum, lot) => sum + Math.max(0, Math.min(100, Number(lot.progress) || 0)), 0) / lots.length);
}
export function isLateChantier(chantier, today = localDateKey()) {
  return Boolean(chantier.end_date && chantier.end_date < today && !['clos', 'receptionne'].includes(chantier.status));
}
export function filterChantiers(chantiers, search = '', status = 'all', sort = 'deadline', today = localDateKey()) {
  const term = normalizeSearch(search);
  return chantiers.filter(item => {
    const matchesSearch = !term || normalizeSearch([item.name, item.client_name, item.address].filter(Boolean).join(' ')).includes(term);
    const matchesStatus = status === 'all' || (status === 'late' ? isLateChantier(item, today) : item.status === status);
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'fr');
    if (sort === 'progress') return chantierProgress(b.chantier_lots) - chantierProgress(a.chantier_lots);
    return (a.end_date || '9999').localeCompare(b.end_date || '9999');
  });
}
export function defaultPlanningView(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (['gantt', 'list', 'month'].includes(saved)) return saved;
  return window.matchMedia('(max-width: 768px)').matches ? 'list' : 'gantt';
}
