// src/services/monthlyExportService.js
// Service d'export mensuel pour l'expert-comptable
// Agrège les données par employé pour la fiche de paie

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

/**
 * Récupère toutes les données nécessaires pour l'export mensuel
 * @param {number} year - Année (ex: 2026)
 * @param {number} month - Mois 1-12 (ex: 2 pour février)
 * @returns {Promise<{data, error}>}
 */
export async function getMonthlyExportData(year, month) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Requêtes parallèles
    const [profilesRes, interventionsRes, leavesRes, expensesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, is_admin'),

      supabase
        .from('interventions')
        .select(`
          id, client, address, date, time, status,
          scheduled_dates, km_start, km_end, report,
          intervention_assignments (
            user_id,
            profiles (full_name)
          )
        `)
        .eq('is_archived', false),

      supabase
        .from('leave_requests')
        .select('*, profiles(full_name)')
        .in('status', ['Approuvée', 'En attente']),

      supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (interventionsRes.error) throw interventionsRes.error;
    if (leavesRes.error) throw leavesRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const profiles = profilesRes.data || [];
    const allInterventions = interventionsRes.data || [];
    const allLeaves = leavesRes.data || [];
    const expenses = expensesRes.data || [];

    // Filtrer les interventions du mois
    const monthInterventions = allInterventions.filter(iv => {
      // Vérifier scheduled_dates (JSONB array de dates)
      if (iv.scheduled_dates && Array.isArray(iv.scheduled_dates)) {
        return iv.scheduled_dates.some(d => {
          const date = new Date(d);
          return date.getFullYear() === year && (date.getMonth() + 1) === month;
        });
      }
      // Fallback sur le champ date
      if (iv.date) {
        const date = new Date(iv.date);
        return date.getFullYear() === year && (date.getMonth() + 1) === month;
      }
      return false;
    });

    // Filtrer les congés qui chevauchent le mois
    const monthLeaves = allLeaves.filter(leave => {
      if (!leave.start_date || !leave.end_date) return false;
      const ls = new Date(leave.start_date);
      const le = new Date(leave.end_date);
      const ms = new Date(startDate);
      const me = new Date(endDate);
      return ls <= me && le >= ms;
    });

    // Agréger par employé
    const employeeData = profiles
      .filter(p => !p.is_admin)
      .map(profile => {
        const userId = profile.id;

        // --- Interventions assignées à cet employé ---
        const userInterventions = monthInterventions.filter(iv =>
          iv.intervention_assignments?.some(a => a.user_id === userId)
        );

        // Compter les jours travaillés (dates uniques d'intervention)
        const workedDatesSet = new Set();
        userInterventions.forEach(iv => {
          if (iv.scheduled_dates && Array.isArray(iv.scheduled_dates)) {
            iv.scheduled_dates.forEach(d => {
              const date = new Date(d);
              if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
                workedDatesSet.add(d);
              }
            });
          } else if (iv.date) {
            workedDatesSet.add(iv.date);
          }
        });

        // Calculer les heures depuis les reports (arrivalTime / departureTime)
        let totalMinutesWorked = 0;
        userInterventions.forEach(iv => {
          if (iv.report?.arrivalTime && iv.report?.departureTime) {
            const arrival = new Date(iv.report.arrivalTime);
            const departure = new Date(iv.report.departureTime);
            const diff = (departure - arrival) / (1000 * 60); // minutes
            if (diff > 0 && diff < 24 * 60) {
              totalMinutesWorked += diff;
            }
          }
        });

        // Kilomètres
        let totalKm = 0;
        userInterventions.forEach(iv => {
          const kmStart = iv.km_start || iv.report?.km_start;
          const kmEnd = iv.km_end || iv.report?.km_end;
          if (kmStart && kmEnd && kmEnd > kmStart) {
            totalKm += (kmEnd - kmStart);
          }
        });

        // Zones de déplacement (extraire les villes uniques des adresses)
        const zones = new Set();
        userInterventions.forEach(iv => {
          if (iv.address) {
            // Extraire la ville (après le code postal ou dernière partie)
            const city = extractCity(iv.address);
            if (city) zones.add(city);
          }
        });

        // Paniers repas = nombre de jours travaillés avec intervention
        // (convention : 1 panier repas par jour d'intervention sur site)
        const paniersRepas = workedDatesSet.size;

        // --- Congés ---
        const userLeaves = monthLeaves.filter(l => l.user_id === userId);
        let leaveDays = 0;
        userLeaves.forEach(leave => {
          const ls = new Date(Math.max(new Date(leave.start_date), new Date(startDate)));
          const le = new Date(Math.min(new Date(leave.end_date), new Date(endDate)));
          // Compter les jours ouvrés entre les deux dates
          let current = new Date(ls);
          while (current <= le) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) leaveDays++;
            current.setDate(current.getDate() + 1);
          }
        });

        // --- Dépenses ---
        const userExpenses = expenses.filter(e => e.user_id === userId);
        const expensesByCategory = {};
        let totalExpenses = 0;
        userExpenses.forEach(e => {
          const cat = e.category || 'other';
          if (!expensesByCategory[cat]) expensesByCategory[cat] = 0;
          expensesByCategory[cat] += (e.amount || 0);
          totalExpenses += (e.amount || 0);
        });

        return {
          id: userId,
          fullName: profile.full_name,
          email: profile.email,

          // Jours et heures
          workedDays: workedDatesSet.size,
          workedDates: Array.from(workedDatesSet).sort(),
          totalHours: Math.round(totalMinutesWorked / 60 * 100) / 100,

          // Déplacements
          totalKm,
          zones: Array.from(zones).sort(),
          paniersRepas,

          // Congés
          leaveDays,
          leaves: userLeaves.map(l => ({
            startDate: l.start_date,
            endDate: l.end_date,
            reason: l.reason,
            status: l.status,
          })),

          // Interventions
          interventionCount: userInterventions.length,
          completedCount: userInterventions.filter(i => i.status === 'Terminée').length,

          // Dépenses
          totalExpenses,
          expensesByCategory,
          expenseDetails: userExpenses.map(e => ({
            date: e.date,
            category: e.category,
            amount: e.amount,
            description: e.description,
            status: e.status,
          })),
        };
      });

    return { data: employeeData, error: null };
  } catch (error) {
    logger.error('Erreur export mensuel:', error);
    return { data: null, error };
  }
}

/**
 * Extraire la ville d'une adresse
 * Ex: "12 rue des Lilas, 75015 Paris" → "Paris"
 * Ex: "Zone industrielle, 69100 Villeurbanne" → "Villeurbanne"
 */
function extractCity(address) {
  if (!address) return null;
  // Chercher le pattern "XXXXX Ville" (code postal + ville)
  const match = address.match(/\b\d{5}\s+([A-Za-zÀ-ÿ\s-]+)/);
  if (match) return match[1].trim();
  // Sinon prendre la dernière partie après la virgule
  const parts = address.split(',');
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim();
    // Retirer un éventuel code postal
    return last.replace(/^\d{5}\s*/, '').trim() || last;
  }
  return null;
}

/**
 * Génère un CSV à partir des données d'export
 */
export function generateCSV(employeeData, year, month) {
  const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const headers = [
    'Employé',
    'Email',
    'Jours travaillés',
    'Heures totales',
    'Interventions',
    'Terminées',
    'Km parcourus',
    'Zones de déplacement',
    'Paniers repas',
    'Jours de congé',
    'Dépenses transport (€)',
    'Dépenses repas (€)',
    'Dépenses carburant (€)',
    'Dépenses parking (€)',
    'Dépenses téléphone (€)',
    'Dépenses fournitures (€)',
    'Dépenses hébergement (€)',
    'Autres dépenses (€)',
    'Total dépenses (€)',
  ];

  const rows = employeeData.map(emp => [
    emp.fullName,
    emp.email,
    emp.workedDays,
    emp.totalHours,
    emp.interventionCount,
    emp.completedCount,
    emp.totalKm,
    emp.zones.join(' / '),
    emp.paniersRepas,
    emp.leaveDays,
    (emp.expensesByCategory.transport || 0).toFixed(2),
    (emp.expensesByCategory.meals || 0).toFixed(2),
    (emp.expensesByCategory.fuel || 0).toFixed(2),
    (emp.expensesByCategory.parking || 0).toFixed(2),
    (emp.expensesByCategory.phone || 0).toFixed(2),
    (emp.expensesByCategory.supplies || 0).toFixed(2),
    (emp.expensesByCategory.accommodation || 0).toFixed(2),
    (emp.expensesByCategory.other || 0).toFixed(2),
    emp.totalExpenses.toFixed(2),
  ]);

  const csvContent = [
    `Export comptable - ${monthName}`,
    '',
    headers.join(';'),
    ...rows.map(r => r.join(';')),
  ].join('\n');

  return csvContent;
}

/**
 * Télécharger un fichier CSV
 */
export function downloadCSV(csvContent, filename) {
  // BOM UTF-8 pour Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
