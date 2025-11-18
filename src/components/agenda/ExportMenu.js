// src/components/agenda/ExportMenu.js
// Menu d'export pour l'agenda (PDF, Excel, Impression)

import React, { useState } from 'react';
import { DownloadIcon, FileIcon } from '../SharedUI';
import './ExportMenu.css';

/**
 * ExportMenu Component
 * Menu pour exporter l'agenda en différents formats
 *
 * @param {Array} interventions - Interventions à exporter
 * @param {Array} employees - Liste des employés
 * @param {Object} dateRange - Plage de dates
 * @param {string} viewMode - Mode de vue actuel
 */
const ExportMenu = ({
  interventions = [],
  employees = [],
  dateRange,
  viewMode = 'week'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Générer un export CSV/Excel
   */
  const handleExportExcel = () => {
    setIsExporting(true);

    try {
      // Préparer les données pour CSV
      const headers = [
        'Date',
        'Heure',
        'Client',
        'Service',
        'Adresse',
        'Intervenant(s)',
        'Durée estimée',
        'Urgent',
        'SAV',
        'Statut'
      ];

      const rows = interventions.map(itv => {
        const assignees = itv.intervention_assignments
          ?.map(a => a.profiles?.full_name)
          .filter(Boolean)
          .join(', ') || 'Non assigné';

        const urgent = itv.report?.needs?.some(n => n.urgent) ? 'Oui' : 'Non';
        const sav = itv.report?.follow_up_required ? 'Oui' : 'Non';

        return [
          itv.date || '',
          itv.time || itv.time_start || '',
          itv.client || '',
          itv.service || '',
          itv.address || '',
          assignees,
          itv.estimated_duration ? `${itv.estimated_duration}h` : '2h',
          urgent,
          sav,
          itv.status || 'Planifiée'
        ];
      });

      // Générer le CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Créer le fichier et télécharger
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const startDate = dateRange.start.toISOString().split('T')[0];
      const endDate = dateRange.end.toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `agenda_${startDate}_${endDate}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      alert('Erreur lors de l\'export. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Générer un export PDF
   */
  const handleExportPDF = () => {
    setIsExporting(true);

    try {
      // Pour le PDF, on va créer une page HTML optimisée pour l'impression
      const printWindow = window.open('', '_blank');

      const startDate = dateRange.start.toLocaleDateString('fr-FR');
      const endDate = dateRange.end.toLocaleDateString('fr-FR');

      // Grouper par date
      const byDate = {};
      interventions.forEach(itv => {
        const date = itv.date;
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(itv);
      });

      const dates = Object.keys(byDate).sort();

      // Générer le HTML
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Agenda SRP - ${startDate} au ${endDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              font-size: 12px;
              line-height: 1.4;
            }
            h1 {
              font-size: 18px;
              margin-bottom: 10px;
              color: #1e293b;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 5px;
            }
            h2 {
              font-size: 14px;
              margin: 15px 0 8px 0;
              color: #475569;
              background: #f1f5f9;
              padding: 5px 10px;
              border-left: 3px solid #3b82f6;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
              text-align: left;
            }
            th {
              background: #f8fafc;
              font-weight: 600;
              color: #334155;
            }
            tr:nth-child(even) { background: #f8fafc; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
              font-weight: 600;
              margin-right: 4px;
            }
            .badge-urgent { background: #fee2e2; color: #991b1b; }
            .badge-sav { background: #fef3c7; color: #92400e; }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #64748b;
              font-size: 10px;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
            @media print {
              body { padding: 10px; }
              h2 { page-break-after: avoid; }
              table { page-break-inside: avoid; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>📅 Agenda SRP - ${startDate} au ${endDate}</h1>

          ${dates.map(date => {
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            const dayInterventions = byDate[date] || [];

            return `
              <h2>${formattedDate} (${dayInterventions.length} intervention${dayInterventions.length > 1 ? 's' : ''})</h2>
              <table>
                <thead>
                  <tr>
                    <th style="width: 60px;">Heure</th>
                    <th style="width: 120px;">Client</th>
                    <th>Service</th>
                    <th style="width: 150px;">Adresse</th>
                    <th style="width: 100px;">Intervenant(s)</th>
                    <th style="width: 60px;">Durée</th>
                    <th style="width: 80px;">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  ${dayInterventions.map(itv => {
                    const assignees = itv.intervention_assignments
                      ?.map(a => a.profiles?.full_name)
                      .filter(Boolean)
                      .join(', ') || 'Non assigné';

                    const urgent = itv.report?.needs?.some(n => n.urgent);
                    const sav = itv.report?.follow_up_required;

                    return `
                      <tr>
                        <td><strong>${itv.time || itv.time_start || '—'}</strong></td>
                        <td>${itv.client || ''}</td>
                        <td>${itv.service || ''}</td>
                        <td style="font-size: 10px;">${itv.address || ''}</td>
                        <td style="font-size: 10px;">${assignees}</td>
                        <td>${itv.estimated_duration || 2}h</td>
                        <td>
                          ${urgent ? '<span class="badge badge-urgent">URG</span>' : ''}
                          ${sav ? '<span class="badge badge-sav">SAV</span>' : ''}
                          ${!urgent && !sav ? itv.status || 'Planifiée' : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `;
          }).join('')}

          <div class="footer">
            Document généré le ${new Date().toLocaleString('fr-FR')} -
            Total: ${interventions.length} intervention${interventions.length > 1 ? 's' : ''}
          </div>

          <script>
            // Auto-print après chargement
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

      setIsOpen(false);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Imprimer directement
   */
  const handlePrint = () => {
    handleExportPDF();
  };

  return (
    <div className="export-menu">
      <button
        className="export-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu d'export"
        disabled={interventions.length === 0}
      >
        <DownloadIcon />
        <span className="export-btn-text">Exporter</span>
      </button>

      {isOpen && (
        <>
          <div
            className="export-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="export-dropdown">
            <div className="export-header">
              <h4 className="export-title">Exporter l'agenda</h4>
              <button
                className="export-close"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="export-info">
              {interventions.length} intervention{interventions.length > 1 ? 's' : ''}
            </div>

            <div className="export-options">
              <button
                className="export-option"
                onClick={handleExportPDF}
                disabled={isExporting}
              >
                <FileIcon />
                <div className="export-option-content">
                  <div className="export-option-title">PDF</div>
                  <div className="export-option-desc">Format imprimable</div>
                </div>
              </button>

              <button
                className="export-option"
                onClick={handleExportExcel}
                disabled={isExporting}
              >
                <DownloadIcon />
                <div className="export-option-content">
                  <div className="export-option-title">Excel (CSV)</div>
                  <div className="export-option-desc">Pour analyse</div>
                </div>
              </button>

              <button
                className="export-option"
                onClick={handlePrint}
                disabled={isExporting}
              >
                <span style={{ fontSize: '20px' }}>🖨️</span>
                <div className="export-option-content">
                  <div className="export-option-title">Imprimer</div>
                  <div className="export-option-desc">Impression directe</div>
                </div>
              </button>
            </div>

            {isExporting && (
              <div className="export-loading">
                Génération en cours...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExportMenu;
