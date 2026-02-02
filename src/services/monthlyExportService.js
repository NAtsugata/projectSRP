// src/services/monthlyExportService.js
// Service d'export mensuel pour l'expert-comptable
// Agrège les données par employé pour la fiche de paie

import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';
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

  // Résumé global
  let y = 65;
  pdf.setTextColor(...darkText);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Récapitulatif global', mx, y);
  y += 10;

  const totals = employeeData.reduce((acc, e) => ({
    employees: acc.employees + 1,
    workedDays: acc.workedDays + e.workedDays,
    totalHours: acc.totalHours + e.totalHours,
    totalKm: acc.totalKm + e.totalKm,
    paniersRepas: acc.paniersRepas + e.paniersRepas,
    leaveDays: acc.leaveDays + e.leaveDays,
    interventions: acc.interventions + e.interventionCount,
    totalExpenses: acc.totalExpenses + e.totalExpenses,
  }), { employees: 0, workedDays: 0, totalHours: 0, totalKm: 0, paniersRepas: 0, leaveDays: 0, interventions: 0, totalExpenses: 0 });

  const summaryItems = [
    ['Employés', `${totals.employees}`],
    ['Jours travaillés', `${totals.workedDays}`],
    ['Heures totales', `${totals.totalHours}h`],
    ['Interventions', `${totals.interventions}`],
    ['Km parcourus', `${totals.totalKm} km`],
    ['Paniers repas', `${totals.paniersRepas}`],
    ['Jours de congé', `${totals.leaveDays}`],
    ['Total dépenses', `${totals.totalExpenses.toFixed(2)} €`],
  ];

  // Grille résumé (2 colonnes x 4 lignes)
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
    { label: 'Employé', w: 42 },
    { label: 'Jours', w: 16 },
    { label: 'Heures', w: 18 },
    { label: 'Km', w: 18 },
    { label: 'Zones', w: 32 },
    { label: 'Repas', w: 16 },
    { label: 'Congés', w: 16 },
    { label: 'Dépenses', w: 22 },
  ];

  pdf.setFillColor(...blue);
  pdf.rect(mx, y, contentW, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7.5);
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
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');

    colX = mx;
    const rowData = [
      emp.fullName || '',
      `${emp.workedDays}`,
      `${emp.totalHours}h`,
      `${emp.totalKm}`,
      emp.zones.slice(0, 3).join(', ') + (emp.zones.length > 3 ? '...' : ''),
      `${emp.paniersRepas}`,
      `${emp.leaveDays}`,
      `${emp.totalExpenses.toFixed(2)}€`,
    ];

    rowData.forEach((text, ci) => {
      // Tronquer si trop long
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

    // --- Section Activité ---
    y = drawSectionTitle(pdf, 'Activité & Temps de travail', mx, y, contentW);

    const activityRows = [
      ['Jours travaillés', `${emp.workedDays}`],
      ['Heures totales', `${emp.totalHours}h`],
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

      // Split en lignes si trop long
      const lines = pdf.splitTextToSize(datesText, contentW);
      lines.forEach(line => {
        if (y > pageH - 20) { pdf.addPage(); y = 20; }
        pdf.text(line, mx, y);
        y += 4;
      });
    }

    y += 6;

    // --- Section Déplacements ---
    if (y > pageH - 50) { pdf.addPage(); y = 20; }
    y = drawSectionTitle(pdf, 'Déplacements & Paniers repas', mx, y, contentW);

    const deplRows = [
      ['Kilomètres parcourus', `${emp.totalKm} km`],
      ['Paniers repas', `${emp.paniersRepas}`],
      ['Zones de déplacement', emp.zones.length > 0 ? emp.zones.join(', ') : 'Aucune'],
    ];
    y = drawKeyValueTable(pdf, deplRows, mx, y, contentW);
    y += 6;

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

        // Label
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...gray);
        pdf.text(label, mx, y + 4.5);

        // Fond de barre
        const barX = mx + 35;
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(barX, y + 1, barMaxW, 4, 1.5, 1.5, 'F');

        // Barre remplie
        const fillW = Math.max((pct / 100) * barMaxW, 2);
        pdf.setFillColor(...blue);
        pdf.roundedRect(barX, y + 1, fillW, 4, 1.5, 1.5, 'F');

        // Montant
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

        // Mini tableau
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
    pdf.text(`SRP — Export comptable ${monthLabel}`, mx, footerY);
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
  const halfW = w / 2;
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
