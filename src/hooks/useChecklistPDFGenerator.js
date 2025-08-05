// src/hooks/useChecklistPDFGenerator.js
import { jsPDF } from "jspdf";
import 'jspdf-autotable'; // Pour des tableaux plus complexes si besoin un jour

/**
 * Hook personnalisé pour générer des PDF à partir des données de checklist.
 * @returns {{generateChecklistPDF: function}}
 */
export const useChecklistPDFGenerator = () => {

  /**
   * Génère un fichier PDF à partir d'un modèle, de l'état de la checklist et des infos d'intervention.
   * @param {object} template - Le modèle de checklist (depuis checklistTemplates.js).
   * @param {object} checklistState - L'état actuel des champs de la checklist.
   * @param {object} intervention - L'objet intervention contenant les infos client, etc.
   * @returns {Promise<File>} - Une promesse qui résout avec le fichier PDF généré.
   */
  const generateChecklistPDF = (template, checklistState, intervention) => {
    return new Promise((resolve) => {
      const doc = new jsPDF();
      let y = 15;

      const addText = (text, x, isBold = false) => {
        doc.setFont(undefined, isBold ? 'bold' : 'normal');
        doc.text(text, x, y);
      };

      const addLine = () => {
        y += 2;
        doc.line(10, y, 200, y);
        y += 6;
      };

      // --- En-tête du document ---
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      addText(template.title, 10, true);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      addText(`Client: ${intervention.client || 'N/A'}`, 10);
      addText(`Date: ${new Date(intervention.date).toLocaleDateString('fr-FR') || 'N/A'}`, 120);
      y += 6;
      addText(`Adresse: ${intervention.address || 'N/A'}`, 10);
      const technicianName = intervention.intervention_assignments?.[0]?.profiles?.full_name || 'N/A';
      addText(`Technicien: ${technicianName}`, 120);
      y += 8;
      addLine();

      // --- Contenu de la checklist section par section ---
      doc.setTextColor(40, 40, 40);
      template.sections.forEach(section => {
        doc.setFontSize(12);
        addText(section.title, 10, true);
        y += 8;
        section.items.forEach(item => {
          doc.setFontSize(10);
          const value = checklistState[item.id];

          switch (item.type) {
            case 'checkbox':
              doc.setFont('ZapfDingbats');
              addText(value ? '✔' : '✗', 15); // Utilise des icônes plus claires
              doc.setFont('Helvetica');
              addText(item.label, 22);
              y += 7;
              break;

            case 'text':
              addText(`- ${item.label}:`, 15);
              addText(value || 'Non renseigné', 80, true);
              y += 7;
              break;

            case 'textarea':
              y += 2;
              addText(`${item.label}:`, 15, true);
              y += 6;
              doc.setTextColor(80, 80, 80);
              const remarks = value || "Aucune remarque.";
              const splitText = doc.splitTextToSize(remarks, 170);
              doc.text(splitText, 20, y);
              doc.setTextColor(40, 40, 40);
              y += (splitText.length * 5) + 5;
              break;

            default:
              break;
          }
        });
        y += 4;
      });

      // --- Génération du fichier ---
      const pdfBlob = doc.output('blob');
      const safeClientName = intervention.client.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Checklist_${template.id}_${safeClientName}_${intervention.id}.pdf`;

      const pdfFile = new File([pdfBlob], fileName, {
        type: 'application/pdf',
        lastModified: Date.now(),
      });

      resolve(pdfFile);
    });
  };

  return { generateChecklistPDF };
};
