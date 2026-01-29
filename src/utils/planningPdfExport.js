// src/utils/planningPdfExport.js
// Export PDF du planning hebdomadaire ou mensuel

import { jsPDF } from 'jspdf';
import logger from './logger';

/**
 * Génère un PDF du planning hebdomadaire
 */
export async function exportWeeklyPlanningPdf(weekDays, teams, options = {}) {
  const {
    title = 'Planning Hebdomadaire',
    companyName = 'SRP',
  } = options;

  logger.log('[PDF] Génération du planning hebdomadaire...');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Couleurs
  const headerBg = [59, 130, 246]; // Blue
  const lightGray = [248, 250, 252];
  const darkText = [51, 65, 85];
  const weekendBg = [254, 252, 232];

  // === HEADER ===
  pdf.setFillColor(...headerBg);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, 15);

  // Période
  const startDate = weekDays[0].date;
  const endDate = weekDays[6].date;
  const periodText = `${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')}`;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(periodText, pageWidth - margin - pdf.getTextWidth(periodText), 15);

  // === GRILLE ===
  const gridTop = 35;
  const teamColWidth = 50;
  const dayColWidth = (pageWidth - margin * 2 - teamColWidth) / 7;
  const rowHeight = 18;

  // En-tête des jours
  pdf.setFillColor(...lightGray);
  pdf.rect(margin, gridTop, pageWidth - margin * 2, 12, 'F');

  pdf.setTextColor(...darkText);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Équipes', margin + 5, gridTop + 8);

  weekDays.forEach((day, index) => {
    const x = margin + teamColWidth + (index * dayColWidth);
    const isWeekend = day.isWeekend;

    if (isWeekend) {
      pdf.setFillColor(...weekendBg);
      pdf.rect(x, gridTop, dayColWidth, 12, 'F');
    }

    const dayText = `${day.dayName} ${day.dayNum}`;
    pdf.setTextColor(...darkText);
    pdf.text(dayText, x + dayColWidth / 2 - pdf.getTextWidth(dayText) / 2, gridTop + 8);
  });

  // Lignes des équipes
  let currentY = gridTop + 12;

  teams.forEach((team, teamIndex) => {
    if (currentY + rowHeight > pageHeight - margin) {
      // Nouvelle page si nécessaire
      pdf.addPage();
      currentY = margin;
    }

    // Fond alterné
    if (teamIndex % 2 === 0) {
      pdf.setFillColor(255, 255, 255);
    } else {
      pdf.setFillColor(...lightGray);
    }
    pdf.rect(margin, currentY, pageWidth - margin * 2, rowHeight, 'F');

    // Nom de l'équipe
    pdf.setTextColor(...darkText);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    const teamName = team.name.length > 20 ? team.name.substring(0, 18) + '...' : team.name;
    pdf.text(teamName, margin + 3, currentY + rowHeight / 2 + 2);

    // Interventions par jour
    weekDays.forEach((day, dayIndex) => {
      const x = margin + teamColWidth + (dayIndex * dayColWidth);
      const isWeekend = day.isWeekend;

      if (isWeekend) {
        pdf.setFillColor(...weekendBg);
        pdf.rect(x, currentY, dayColWidth, rowHeight, 'F');
      }

      // Bordure verticale
      pdf.setDrawColor(226, 232, 240);
      pdf.line(x, currentY, x, currentY + rowHeight);

      // Trouver les interventions pour ce jour
      const dayInterventions = team.interventions.filter(itv => {
        const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
        return dates.includes(day.dateStr);
      });

      if (dayInterventions.length > 0) {
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');

        dayInterventions.slice(0, 2).forEach((itv, i) => {
          const time = itv.time?.slice(0, 5) || '08:00';
          const client = itv.client?.length > 12 ? itv.client.substring(0, 10) + '..' : itv.client;
          const text = `${time} ${client}`;

          // Couleur selon statut
          if (itv.status === 'Terminée') {
            pdf.setTextColor(148, 163, 184);
          } else if (itv.status === 'En cours') {
            pdf.setTextColor(245, 158, 11);
          } else {
            pdf.setTextColor(59, 130, 246);
          }

          pdf.text(text, x + 2, currentY + 5 + (i * 5));
        });

        if (dayInterventions.length > 2) {
          pdf.setTextColor(100, 116, 139);
          pdf.text(`+${dayInterventions.length - 2}`, x + 2, currentY + 15);
        }
      }
    });

    // Bordure horizontale
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);

    currentY += rowHeight;
  });

  // === FOOTER ===
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  const footerText = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${companyName}`;
  pdf.text(footerText, margin, pageHeight - 5);

  // Légende
  const legendY = pageHeight - 12;
  pdf.setFontSize(7);

  pdf.setFillColor(59, 130, 246);
  pdf.circle(pageWidth - 80, legendY, 2, 'F');
  pdf.setTextColor(...darkText);
  pdf.text('À venir', pageWidth - 76, legendY + 1);

  pdf.setFillColor(245, 158, 11);
  pdf.circle(pageWidth - 55, legendY, 2, 'F');
  pdf.text('En cours', pageWidth - 51, legendY + 1);

  pdf.setFillColor(148, 163, 184);
  pdf.circle(pageWidth - 28, legendY, 2, 'F');
  pdf.text('Terminée', pageWidth - 24, legendY + 1);

  // Téléchargement
  const filename = `planning_${startDate.toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);

  logger.log('[PDF] Planning exporté:', filename);
  return filename;
}

/**
 * Génère un PDF du planning mensuel
 */
export async function exportMonthlyPlanningPdf(year, month, interventions, options = {}) {
  const {
    title = 'Planning Mensuel',
    companyName = 'SRP',
  } = options;

  logger.log('[PDF] Génération du planning mensuel...');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Couleurs
  const headerBg = [139, 92, 246]; // Purple
  const lightGray = [248, 250, 252];
  const darkText = [51, 65, 85];

  // Mois
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // === HEADER ===
  pdf.setFillColor(...headerBg);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${title} - ${monthName}`, margin, 15);

  // Compter les interventions du mois
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-31`;
  const monthInterventions = interventions.filter(itv => {
    const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
    return dates.some(d => d >= monthStart && d <= monthEnd);
  });

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${monthInterventions.length} intervention(s)`, pageWidth - margin - 30, 15);

  // === CALENDRIER ===
  const calTop = 35;
  const dayWidth = (pageWidth - margin * 2) / 7;
  const dayHeight = 22;
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // En-tête des jours
  pdf.setFillColor(...lightGray);
  pdf.rect(margin, calTop, pageWidth - margin * 2, 10, 'F');

  pdf.setTextColor(...darkText);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');

  weekdays.forEach((day, i) => {
    const x = margin + (i * dayWidth) + dayWidth / 2 - pdf.getTextWidth(day) / 2;
    pdf.text(day, x, calTop + 7);
  });

  // Générer les jours du mois
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  let currentY = calTop + 10;
  let currentX = margin + (daysToAdd * dayWidth);
  const today = new Date().toISOString().split('T')[0];

  // Grouper interventions par date
  const byDate = {};
  interventions.forEach(itv => {
    const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
    dates.forEach(d => {
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(itv);
    });
  });

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayInterventions = byDate[dateStr] || [];
    const isToday = dateStr === today;
    const dayOfWeek = new Date(year, month, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Fond
    if (isToday) {
      pdf.setFillColor(219, 234, 254);
    } else if (isWeekend) {
      pdf.setFillColor(254, 252, 232);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(currentX, currentY, dayWidth, dayHeight, 'F');

    // Bordure
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(currentX, currentY, dayWidth, dayHeight, 'S');

    // Numéro du jour
    pdf.setFontSize(10);
    pdf.setFont('helvetica', isToday ? 'bold' : 'normal');
    pdf.setTextColor(isToday ? 59 : 51, isToday ? 130 : 65, isToday ? 246 : 85);
    pdf.text(String(d), currentX + 2, currentY + 5);

    // Indicateurs d'interventions
    if (dayInterventions.length > 0) {
      pdf.setFontSize(6);
      const count = dayInterventions.length;
      const completed = dayInterventions.filter(i => i.status === 'Terminée').length;

      // Petit badge
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(currentX + 2, currentY + 8, 18, 5, 1, 1, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${count} interv.`, currentX + 3, currentY + 11.5);

      if (completed > 0) {
        pdf.setTextColor(34, 197, 94);
        pdf.text(`✓${completed}`, currentX + 2, currentY + 18);
      }
    }

    // Passer à la colonne suivante
    currentX += dayWidth;

    // Nouvelle ligne si fin de semaine
    if ((daysToAdd + d) % 7 === 0) {
      currentX = margin;
      currentY += dayHeight;
    }
  }

  // === FOOTER ===
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(8);
  const footerText = `Généré le ${new Date().toLocaleDateString('fr-FR')} - ${companyName}`;
  pdf.text(footerText, margin, pageHeight - 5);

  // Téléchargement
  const filename = `planning_${year}-${String(month + 1).padStart(2, '0')}.pdf`;
  pdf.save(filename);

  logger.log('[PDF] Planning mensuel exporté:', filename);
  return filename;
}

export default {
  exportWeeklyPlanningPdf,
  exportMonthlyPlanningPdf
};
