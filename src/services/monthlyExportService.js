// src/services/monthlyExportService.js
// Service d'export mensuel pour l'expert-comptable
// Agrège les données par employé pour la fiche de paie

import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
import logger from '../utils/logger';

// Adresse de départ de l'entreprise
const COMPANY_HQ = '422 route de Digne, 04660 Champtercier';

// Base horaire légale : 35h/semaine = 7h/jour
const HEURES_PAR_JOUR = 7;

// Zones de déplacement BTP (distance aller depuis le siège en km)
const ZONE_THRESHOLDS = [
  { maxKm: 10, label: 'Zone 1 (0-10 km)' },
  { maxKm: 20, label: 'Zone 2 (10-20 km)' },
  { maxKm: 30, label: 'Zone 3 (20-30 km)' },
  { maxKm: 50, label: 'Zone 4 (30-50 km)' },
  { maxKm: Infinity, label: 'Zone 5 (50+ km)' },
];

/**
 * Détermine la zone de déplacement en fonction de la distance aller (km)
 */
function getZone(distanceKm) {
  for (const z of ZONE_THRESHOLDS) {
    if (distanceKm <= z.maxKm) return z.label;
  }
  return ZONE_THRESHOLDS[ZONE_THRESHOLDS.length - 1].label;
}

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

        // Calculer les heures réelles depuis les reports (arrivalTime / departureTime)
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

        const totalHoursReal = Math.round(totalMinutesWorked / 60 * 100) / 100;

        // Heures base 35h : 7h par jour travaillé
        const workedDays = workedDatesSet.size;
        const baseHours = workedDays * HEURES_PAR_JOUR;
        const heuresSupp = Math.max(0, Math.round((totalHoursReal - baseHours) * 100) / 100);

        // Kilomètres totaux et calcul zones par intervention
        let totalKm = 0;
        const interventionDetails = [];
        const zoneCount = {}; // { "Zone 1 (0-10 km)": 3, ... }

        userInterventions.forEach(iv => {
          const kmStart = iv.km_start || iv.report?.km_start;
          const kmEnd = iv.km_end || iv.report?.km_end;
          let interventionKm = 0;
          let distanceAller = 0;

          if (kmStart && kmEnd && kmEnd > kmStart) {
            interventionKm = kmEnd - kmStart;
            totalKm += interventionKm;
            // Distance aller = km total / 2 (aller-retour depuis Champtercier)
            distanceAller = Math.round(interventionKm / 2);
          }

          const city = extractCity(iv.address);
          const zone = distanceAller > 0 ? getZone(distanceAller) : null;

          if (zone) {
            zoneCount[zone] = (zoneCount[zone] || 0) + 1;
          }

          interventionDetails.push({
            id: iv.id,
            client: iv.client,
            address: iv.address || '',
            city: city || '',
            kmTotal: interventionKm,
            distanceAller,
            zone: zone || 'Non calculée',
            status: iv.status,
          });
        });

        // Zones uniques triées par fréquence
        const zones = Object.entries(zoneCount)
          .sort(([, a], [, b]) => b - a)
          .map(([zone, count]) => ({ zone, count }));

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
          workedDays,
          workedDates: Array.from(workedDatesSet).sort(),
          totalHours: totalHoursReal,
          baseHours,
          heuresSupp,

          // Déplacements avec zones
          totalKm,
          zones,           // [{ zone: "Zone 2 (10-20 km)", count: 5 }, ...]
          zoneCount,        // { "Zone 2 (10-20 km)": 5, ... }
          interventionDetails,
          paniersRepas,
          companyHQ: COMPANY_HQ,

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

          // Prime exceptionnelle (défaut vide, modifiable par l'admin)
          primeExceptionnelle: 0,
          primeType: 'brut', // 'brut' ou 'net'
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
    'Heures base (7h/j)',
    'Heures réelles',
    'Heures supplémentaires',
    'Interventions',
    'Terminées',
    'Km parcourus',
    'Zones de déplacement',
    'Détail zones (depuis Champtercier)',
    'Paniers repas',
    'Jours de congé',
    'Prime exceptionnelle (€)',
    'Type prime (brut/net)',
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

  const rows = employeeData.map(emp => {
    const zonesStr = (emp.zones || []).map(z => `${z.zone} (x${z.count})`).join(' / ');
    const zoneDetailStr = (emp.interventionDetails || [])
      .filter(d => d.distanceAller > 0)
      .map(d => `${d.city || d.address}: ${d.distanceAller}km → ${d.zone}`)
      .join(' | ');

    return [
      emp.fullName,
      emp.email,
      emp.workedDays,
      emp.baseHours,
      emp.totalHours,
      emp.heuresSupp,
      emp.interventionCount,
      emp.completedCount,
      emp.totalKm,
      zonesStr,
      zoneDetailStr,
      emp.paniersRepas,
      emp.leaveDays,
      (emp.primeExceptionnelle || 0).toFixed(2),
      emp.primeType || 'brut',
      (emp.expensesByCategory.transport || 0).toFixed(2),
      (emp.expensesByCategory.meals || 0).toFixed(2),
      (emp.expensesByCategory.fuel || 0).toFixed(2),
      (emp.expensesByCategory.parking || 0).toFixed(2),
      (emp.expensesByCategory.phone || 0).toFixed(2),
      (emp.expensesByCategory.supplies || 0).toFixed(2),
      (emp.expensesByCategory.accommodation || 0).toFixed(2),
      (emp.expensesByCategory.other || 0).toFixed(2),
      emp.totalExpenses.toFixed(2),
    ];
  });

  const csvContent = [
    `Export comptable - ${monthName}`,
    `Adresse de départ : ${COMPANY_HQ}`,
    `Base horaire : ${HEURES_PAR_JOUR}h/jour (35h/semaine)`,
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

/* =====================================================================
 * EXPORT PDF — Fiche mensuelle par employé pour l'expert-comptable
 * ===================================================================== */

const EXPENSE_CAT_LABELS = {
  transport: 'Transport',
  meals: 'Repas',
  fuel: 'Carburant',
  parking: 'Parking',
  phone: 'Téléphone',
  supplies: 'Fournitures',
  accommodation: 'Hébergement',
  other: 'Autres',
};

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/**
 * Génère et télécharge un PDF complet pour l'expert-comptable
 */
export function generatePDF(employeeData, year, month) {
  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();   // 297
  const mx = 15; // marge horizontale
  const contentW = pageW - mx * 2;

  // Couleurs
  const blue = [14, 165, 233];
  const darkText = [30, 41, 59];
  const gray = [100, 116, 139];
  const lightBg = [248, 250, 252];
  const white = [255, 255, 255];
  const greenBg = [220, 252, 231];
  const greenText = [22, 101, 52];
  const orangeBg = [255, 247, 237];
  const orangeText = [234, 88, 12];
  const amberBg = [255, 251, 235];

  // ============= PAGE DE GARDE =============
  // Bande bleue en haut
  pdf.setFillColor(...blue);
  pdf.rect(0, 0, pageW, 50, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Export Comptable', mx, 25);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(monthLabel, mx, 38);

  pdf.setFontSize(10);
  const dateStr = `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
  pdf.text(dateStr, pageW - mx - pdf.getTextWidth(dateStr), 38);

  // Info entreprise
  let y = 58;
  pdf.setTextColor(...gray);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Adresse de départ : ${COMPANY_HQ}`, mx, y);
  y += 4;
  pdf.text(`Base horaire : ${HEURES_PAR_JOUR}h/jour (35h/semaine)`, mx, y);
  y += 10;

  // Résumé global
  pdf.setTextColor(...darkText);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Récapitulatif global', mx, y);
  y += 10;

  const totals = employeeData.reduce((acc, e) => ({
    employees: acc.employees + 1,
    workedDays: acc.workedDays + e.workedDays,
    baseHours: acc.baseHours + (e.baseHours || 0),
    totalHours: acc.totalHours + e.totalHours,
    heuresSupp: acc.heuresSupp + (e.heuresSupp || 0),
    totalKm: acc.totalKm + e.totalKm,
    paniersRepas: acc.paniersRepas + e.paniersRepas,
    leaveDays: acc.leaveDays + e.leaveDays,
    interventions: acc.interventions + e.interventionCount,
    totalExpenses: acc.totalExpenses + e.totalExpenses,
    totalPrimes: acc.totalPrimes + (e.primeExceptionnelle || 0),
  }), { employees: 0, workedDays: 0, baseHours: 0, totalHours: 0, heuresSupp: 0, totalKm: 0, paniersRepas: 0, leaveDays: 0, interventions: 0, totalExpenses: 0, totalPrimes: 0 });

  const summaryItems = [
    ['Employés', `${totals.employees}`],
    ['Jours travaillés', `${totals.workedDays}`],
    ['Heures base (35h/sem)', `${totals.baseHours}h`],
    ['Heures réelles', `${totals.totalHours}h`],
    ['Heures supplémentaires', `${totals.heuresSupp}h`],
    ['Km parcourus', `${totals.totalKm} km`],
    ['Paniers repas', `${totals.paniersRepas}`],
    ['Jours de congé', `${totals.leaveDays}`],
    ['Total dépenses', `${totals.totalExpenses.toFixed(2)} €`],
    ['Total primes', `${totals.totalPrimes.toFixed(2)} €`],
  ];

  // Grille résumé (2 colonnes)
  const cellW = contentW / 2;
  const cellH = 10;
  summaryItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = mx + col * cellW;
    const cy = y + row * cellH;

    const isAlt = row % 2 === 0;
    pdf.setFillColor(...(isAlt ? lightBg : white));
    pdf.rect(cx, cy, cellW, cellH, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...gray);
    pdf.text(item[0], cx + 4, cy + 6.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...darkText);
    pdf.text(item[1], cx + cellW - 4, cy + 6.5, { align: 'right' });
  });

  y += Math.ceil(summaryItems.length / 2) * cellH + 15;

  // Tableau récapitulatif
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...darkText);
  pdf.text('Tableau récapitulatif', mx, y);
  y += 8;

  // En-tête du tableau
  const cols = [
    { label: 'Employé', w: 34 },
    { label: 'Jours', w: 14 },
    { label: 'Base', w: 14 },
    { label: 'Réel', w: 14 },
    { label: 'H.Sup', w: 14 },
    { label: 'Km', w: 14 },
    { label: 'Zone princ.', w: 26 },
    { label: 'Repas', w: 14 },
    { label: 'Prime', w: 18 },
    { label: 'Dépenses', w: 18 },
  ];

  pdf.setFillColor(...blue);
  pdf.rect(mx, y, contentW, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');

  let colX = mx;
  cols.forEach(col => {
    pdf.text(col.label, colX + 2, y + 5.5);
    colX += col.w;
  });
  y += 8;

  // Lignes du tableau
  employeeData.forEach((emp, idx) => {
    if (y > pageH - 20) {
      pdf.addPage();
      y = 20;
    }

    const isAlt = idx % 2 === 0;
    pdf.setFillColor(...(isAlt ? lightBg : white));
    pdf.rect(mx, y, contentW, 7, 'F');

    pdf.setTextColor(...darkText);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');

    const mainZone = emp.zones && emp.zones.length > 0 ? emp.zones[0].zone.replace(/\(.+\)/, '').trim() : '-';
    const primeStr = emp.primeExceptionnelle > 0 ? `${emp.primeExceptionnelle}€ ${emp.primeType}` : '-';

    colX = mx;
    const rowData = [
      emp.fullName || '',
      `${emp.workedDays}`,
      `${emp.baseHours || 0}h`,
      `${emp.totalHours}h`,
      `${emp.heuresSupp || 0}h`,
      `${emp.totalKm}`,
      mainZone,
      `${emp.paniersRepas}`,
      primeStr,
      `${emp.totalExpenses.toFixed(2)}€`,
    ];

    rowData.forEach((text, ci) => {
      const maxW = cols[ci].w - 4;
      let displayText = text;
      while (pdf.getTextWidth(displayText) > maxW && displayText.length > 3) {
        displayText = displayText.slice(0, -4) + '...';
      }
      pdf.text(displayText, colX + 2, y + 5);
      colX += cols[ci].w;
    });

    y += 7;
  });

  // ============= FICHES INDIVIDUELLES =============
  employeeData.forEach(emp => {
    pdf.addPage();
    y = 15;

    // En-tête employé
    pdf.setFillColor(...blue);
    pdf.rect(0, 0, pageW, 35, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(emp.fullName, mx, 18);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(emp.email || '', mx, 27);

    pdf.setFontSize(11);
    const mLabel = monthLabel;
    pdf.text(mLabel, pageW - mx - pdf.getTextWidth(mLabel), 18);

    y = 45;

    // --- Section Activité & Heures ---
    y = drawSectionTitle(pdf, 'Activité & Temps de travail (base 35h/semaine)', mx, y, contentW);

    const activityRows = [
      ['Jours travaillés', `${emp.workedDays}`],
      ['Heures base (7h/jour)', `${emp.baseHours || 0}h`],
      ['Heures réelles', `${emp.totalHours}h`],
      ['Heures supplémentaires', `${emp.heuresSupp || 0}h`],
      ['Interventions réalisées', `${emp.interventionCount}`],
      ['Interventions terminées', `${emp.completedCount}`],
    ];
    y = drawKeyValueTable(pdf, activityRows, mx, y, contentW);

    // Dates travaillées
    if (emp.workedDates.length > 0) {
      y += 3;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...gray);
      pdf.text('Dates travaillées :', mx, y);
      y += 4;

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...darkText);
      pdf.setFontSize(7);
      const datesText = emp.workedDates.map(d =>
        new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      ).join('  |  ');

      const lines = pdf.splitTextToSize(datesText, contentW);
      lines.forEach(line => {
        if (y > pageH - 20) { pdf.addPage(); y = 20; }
        pdf.text(line, mx, y);
        y += 4;
      });
    }

    y += 6;

    // --- Section Déplacements & Zones ---
    if (y > pageH - 60) { pdf.addPage(); y = 20; }
    y = drawSectionTitle(pdf, `Déplacements depuis ${COMPANY_HQ}`, mx, y, contentW);

    const deplRows = [
      ['Kilomètres parcourus', `${emp.totalKm} km`],
      ['Paniers repas', `${emp.paniersRepas}`],
    ];
    y = drawKeyValueTable(pdf, deplRows, mx, y, contentW);

    // Détail zones
    if (emp.zones && emp.zones.length > 0) {
      y += 3;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...gray);
      pdf.text('Zones de déplacement :', mx, y);
      y += 5;

      emp.zones.forEach(z => {
        if (y > pageH - 15) { pdf.addPage(); y = 20; }
        pdf.setFillColor(...lightBg);
        pdf.roundedRect(mx, y, contentW, 7, 1, 1, 'F');
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...darkText);
        pdf.text(z.zone, mx + 3, y + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...gray);
        pdf.text(`${z.count} intervention${z.count > 1 ? 's' : ''}`, pageW - mx - 3, y + 5, { align: 'right' });
        y += 8;
      });
    }

    // Détail par chantier
    if (emp.interventionDetails && emp.interventionDetails.length > 0) {
      const detailsWithKm = emp.interventionDetails.filter(d => d.distanceAller > 0);
      if (detailsWithKm.length > 0) {
        y += 3;
        if (y > pageH - 30) { pdf.addPage(); y = 20; }
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...gray);
        pdf.text('Détail par chantier :', mx, y);
        y += 5;

        // Mini tableau
        pdf.setFillColor(...blue);
        pdf.rect(mx, y, contentW, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(6.5);
        pdf.text('Client', mx + 2, y + 4);
        pdf.text('Adresse', mx + 35, y + 4);
        pdf.text('Dist. aller', mx + 110, y + 4);
        pdf.text('Zone', mx + 135, y + 4);
        y += 6;

        detailsWithKm.forEach((d, di) => {
          if (y > pageH - 12) { pdf.addPage(); y = 20; }
          pdf.setFillColor(...(di % 2 === 0 ? lightBg : white));
          pdf.rect(mx, y, contentW, 5.5, 'F');

          pdf.setTextColor(...darkText);
          pdf.setFontSize(6.5);
          pdf.setFont('helvetica', 'normal');

          const clientText = (d.client || '').substring(0, 20);
          pdf.text(clientText, mx + 2, y + 3.8);

          const addrText = (d.address || '').substring(0, 45);
          pdf.text(addrText, mx + 35, y + 3.8);

          pdf.setFont('helvetica', 'bold');
          pdf.text(`${d.distanceAller} km`, mx + 110, y + 3.8);

          pdf.setFont('helvetica', 'normal');
          pdf.text(d.zone, mx + 135, y + 3.8);

          y += 5.5;
        });
      }
    }

    y += 6;

    // --- Section Prime exceptionnelle ---
    if (emp.primeExceptionnelle > 0) {
      if (y > pageH - 30) { pdf.addPage(); y = 20; }
      y = drawSectionTitle(pdf, 'Prime exceptionnelle', mx, y, contentW);

      pdf.setFillColor(...amberBg);
      pdf.roundedRect(mx, y, contentW, 10, 1.5, 1.5, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...darkText);
      pdf.text(`${emp.primeExceptionnelle.toFixed(2)} €`, mx + 4, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...gray);
      pdf.text(`(${emp.primeType === 'net' ? 'Net' : 'Brut'})`, mx + 4 + pdf.getTextWidth(`${emp.primeExceptionnelle.toFixed(2)} €`) + 3, y + 7);
      y += 14;
    }

    // --- Section Congés ---
    if (emp.leaveDays > 0) {
      if (y > pageH - 50) { pdf.addPage(); y = 20; }
      y = drawSectionTitle(pdf, `Congés (${emp.leaveDays} jours)`, mx, y, contentW);

      emp.leaves.forEach(leave => {
        if (y > pageH - 20) { pdf.addPage(); y = 20; }

        const isApproved = leave.status === 'Approuvée';
        pdf.setFillColor(...(isApproved ? greenBg : orangeBg));
        pdf.roundedRect(mx, y, contentW, 9, 1.5, 1.5, 'F');

        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...(isApproved ? greenText : orangeText));
        pdf.text(leave.status, mx + 3, y + 6);

        pdf.setTextColor(...darkText);
        pdf.setFont('helvetica', 'normal');
        const dateRange = `${new Date(leave.startDate).toLocaleDateString('fr-FR')} — ${new Date(leave.endDate).toLocaleDateString('fr-FR')}`;
        pdf.text(dateRange, mx + 30, y + 6);

        if (leave.reason) {
          pdf.setTextColor(...gray);
          pdf.text(leave.reason, mx + 85, y + 6);
        }
        y += 11;
      });
      y += 4;
    }

    // --- Section Dépenses ---
    if (emp.totalExpenses > 0) {
      if (y > pageH - 60) { pdf.addPage(); y = 20; }
      y = drawSectionTitle(pdf, `Dépenses — Total : ${emp.totalExpenses.toFixed(2)} €`, mx, y, contentW);

      // Barres par catégorie
      const cats = Object.entries(emp.expensesByCategory)
        .filter(([, amount]) => amount > 0)
        .sort(([, a], [, b]) => b - a);

      cats.forEach(([cat, amount]) => {
        if (y > pageH - 15) { pdf.addPage(); y = 20; }

        const label = EXPENSE_CAT_LABELS[cat] || cat;
        const pct = Math.min((amount / emp.totalExpenses) * 100, 100);
        const barMaxW = contentW - 70;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...gray);
        pdf.text(label, mx, y + 4.5);

        const barX = mx + 35;
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(barX, y + 1, barMaxW, 4, 1.5, 1.5, 'F');

        const fillW = Math.max((pct / 100) * barMaxW, 2);
        pdf.setFillColor(...blue);
        pdf.roundedRect(barX, y + 1, fillW, 4, 1.5, 1.5, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...darkText);
        pdf.text(`${amount.toFixed(2)} €`, pageW - mx, y + 4.5, { align: 'right' });

        y += 8;
      });

      // Détail des dépenses
      if (emp.expenseDetails.length > 0) {
        y += 4;
        if (y > pageH - 30) { pdf.addPage(); y = 20; }

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...gray);
        pdf.text('Détail des dépenses :', mx, y);
        y += 5;

        pdf.setFillColor(...blue);
        pdf.rect(mx, y, contentW, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(6.5);
        pdf.text('Date', mx + 2, y + 4);
        pdf.text('Catégorie', mx + 28, y + 4);
        pdf.text('Description', mx + 60, y + 4);
        pdf.text('Montant', pageW - mx - 2, y + 4, { align: 'right' });
        pdf.text('Statut', mx + 145, y + 4);
        y += 6;

        emp.expenseDetails.forEach((exp, ei) => {
          if (y > pageH - 12) { pdf.addPage(); y = 20; }

          pdf.setFillColor(...(ei % 2 === 0 ? lightBg : white));
          pdf.rect(mx, y, contentW, 5.5, 'F');

          pdf.setTextColor(...darkText);
          pdf.setFontSize(6.5);
          pdf.setFont('helvetica', 'normal');

          pdf.text(exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : '', mx + 2, y + 3.8);
          pdf.text(EXPENSE_CAT_LABELS[exp.category] || exp.category || '', mx + 28, y + 3.8);

          const desc = (exp.description || '').substring(0, 40);
          pdf.text(desc, mx + 60, y + 3.8);

          pdf.setFont('helvetica', 'bold');
          pdf.text(`${(exp.amount || 0).toFixed(2)} €`, pageW - mx - 2, y + 3.8, { align: 'right' });

          pdf.setFont('helvetica', 'normal');
          pdf.text(exp.status || '', mx + 145, y + 3.8);

          y += 5.5;
        });
      }
    }

    // Pied de page
    const footerY = pageH - 10;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(mx, footerY - 3, pageW - mx, footerY - 3);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...gray);
    pdf.text(`SRP — Export comptable ${monthLabel} — Départ : ${COMPANY_HQ}`, mx, footerY);
    pdf.text(`${emp.fullName}`, pageW - mx, footerY, { align: 'right' });
  });

  // Numéros de pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Page ${i}/${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
  }

  // Télécharger
  const filename = `export_comptable_${year}-${String(month).padStart(2, '0')}.pdf`;
  pdf.save(filename);
}

/* Helpers PDF */

function drawSectionTitle(pdf, title, x, y, w) {
  pdf.setFillColor(14, 165, 233);
  pdf.rect(x, y, 3, 8, 'F');

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text(title, x + 6, y + 6);

  pdf.setDrawColor(226, 232, 240);
  pdf.line(x, y + 9, x + w, y + 9);

  return y + 13;
}

function drawKeyValueTable(pdf, rows, x, y, w) {
  const rowH = 7.5;

  rows.forEach((row, i) => {
    const isAlt = i % 2 === 0;
    pdf.setFillColor(...(isAlt ? [248, 250, 252] : [255, 255, 255]));
    pdf.rect(x, y, w, rowH, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(row[0], x + 4, y + 5.2);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(row[1], x + w - 4, y + 5.2, { align: 'right' });

    y += rowH;
  });

  return y;
}
