// src/utils/pdfExport.js
// Utilitaires pour l'export PDF des estimations

/**
 * Prépare et déclenche l'impression/export PDF
 * @param {string} title - Titre du document
 * @param {Object} options - Options supplémentaires
 */
export const exportToPDF = (title = 'Estimation Primes Énergétiques', options = {}) => {
  const {
    filename = 'estimation-primes-energetiques.pdf',
    beforePrint = null,
    afterPrint = null,
  } = options;

  // Ajouter un titre au document pour l'export
  const originalTitle = document.title;
  document.title = title;

  // Ajouter une classe pour les styles d'impression
  document.body.classList.add('printing');

  // Callback avant impression
  if (beforePrint && typeof beforePrint === 'function') {
    beforePrint();
  }

  // Déclencher l'impression
  window.print();

  // Callback après impression
  const handleAfterPrint = () => {
    document.title = originalTitle;
    document.body.classList.remove('printing');

    if (afterPrint && typeof afterPrint === 'function') {
      afterPrint();
    }

    // Nettoyer l'event listener
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  window.addEventListener('afterprint', handleAfterPrint);
};

/**
 * Génère un nom de fichier pour l'estimation
 * @param {string} type - Type de calcul ('individual' ou 'copro')
 * @param {Object} data - Données du formulaire
 * @returns {string} - Nom de fichier
 */
export const generateFilename = (type, data = {}) => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const prefix = type === 'copro' ? 'copropriete' : 'logement-individuel';

  if (type === 'copro' && data.housing_count) {
    return `estimation-${prefix}-${data.housing_count}logements-${date}.pdf`;
  }

  if (type === 'individual' && data.postal_code) {
    return `estimation-${prefix}-${data.postal_code}-${date}.pdf`;
  }

  return `estimation-${prefix}-${date}.pdf`;
};

/**
 * Formate une date pour l'affichage dans le PDF
 * @param {Date} date - Date à formater
 * @returns {string} - Date formatée
 */
export const formatDateForPDF = (date = new Date()) => {
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Génère un en-tête pour le PDF
 * @param {Object} metadata - Métadonnées du document
 * @returns {string} - HTML de l'en-tête
 */
export const generatePDFHeader = (metadata = {}) => {
  const {
    title = 'Estimation Primes Énergétiques',
    subtitle = 'CEE + MaPrimeRénov\'',
    date = new Date(),
    reference = null,
  } = metadata;

  return `
    <div class="pdf-header">
      <div class="pdf-header-content">
        <h1>${title}</h1>
        <p>${subtitle}</p>
        <p class="pdf-date">Généré le ${formatDateForPDF(date)}</p>
        ${reference ? `<p class="pdf-reference">Référence : ${reference}</p>` : ''}
      </div>
    </div>
  `;
};

/**
 * Génère un pied de page pour le PDF
 * @param {number} pageNumber - Numéro de page (optionnel)
 * @returns {string} - HTML du pied de page
 */
export const generatePDFFooter = (pageNumber = null) => {
  const currentYear = new Date().getFullYear();

  return `
    <div class="pdf-footer">
      <div class="pdf-footer-content">
        <p>
          <strong>Document indicatif non contractuel</strong> -
          Barèmes ${currentYear} CEE et MaPrimeRénov'
        </p>
        <p>
          Vérifiez votre éligibilité auprès de France Rénov' : 0 808 800 700 -
          <a href="https://france-renov.gouv.fr">france-renov.gouv.fr</a>
        </p>
        ${pageNumber ? `<p class="pdf-page-number">Page ${pageNumber}</p>` : ''}
      </div>
    </div>
  `;
};

/**
 * Prépare le document pour l'export PDF
 * Ajoute les métadonnées et optimise le contenu
 * @param {Object} options - Options de préparation
 */
export const preparePDFExport = (options = {}) => {
  const {
    type = 'individual',
    title = 'Estimation Primes Énergétiques',
    data = {},
  } = options;

  // Générer un nom de fichier
  const filename = generateFilename(type, data);

  // Créer une référence unique
  const reference = `EST-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // Métadonnées
  const metadata = {
    title,
    subtitle: type === 'copro' ? 'MaPrimeRénov\' Copropriété' : 'CEE + MaPrimeRénov\'',
    date: new Date(),
    reference,
  };

  return {
    filename,
    reference,
    metadata,
  };
};

/**
 * Styles CSS pour l'impression/PDF
 * À intégrer dans le CSS global ou dans un <style> tag
 */
export const getPrintStyles = () => `
  @media print {
    @page {
      size: A4;
      margin: 2cm 1.5cm;
    }

    body {
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: white;
    }

    .subsidy-calculator,
    .subsidy-result {
      box-shadow: none;
      border: none;
      max-width: 100%;
      padding: 0;
    }

    /* Cacher les boutons et éléments interactifs */
    .form-navigation,
    .result-actions,
    .refinement-form,
    .refinement-prompt,
    .mode-selection,
    button,
    .btn {
      display: none !important;
    }

    /* En-tête PDF */
    .pdf-header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #000;
    }

    .pdf-header h1 {
      font-size: 24pt;
      margin-bottom: 5px;
    }

    .pdf-date,
    .pdf-reference {
      font-size: 10pt;
      color: #666;
    }

    /* Pied de page PDF */
    .pdf-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 8pt;
      padding-top: 10px;
      border-top: 1px solid #000;
    }

    /* Forcer les sauts de page */
    .legal-notices {
      page-break-before: always;
    }

    .subsidy-card {
      page-break-inside: avoid;
    }

    /* Optimiser les couleurs pour l'impression */
    .subsidy-card,
    .details-card {
      background: #f5f5f5 !important;
      border: 1px solid #000;
    }

    /* Masquer les gradients */
    .subsidy-card {
      background: white !important;
      border: 2px solid #000 !important;
    }

    /* Liens en noir avec URL */
    a {
      color: #000;
      text-decoration: underline;
    }

    a[href]:after {
      content: " (" attr(href) ")";
      font-size: 8pt;
    }
  }

  /* Classe pour préparer l'impression */
  body.printing {
    overflow: visible;
  }

  body.printing * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

export default {
  exportToPDF,
  generateFilename,
  formatDateForPDF,
  generatePDFHeader,
  generatePDFFooter,
  preparePDFExport,
  getPrintStyles,
};
