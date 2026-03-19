/**
 * ============================================================
 * CALCULATEUR D'AIDES ÉTAT 2026 - STYLE CEDEO
 * ============================================================
 * Système complet de calcul des primes énergétiques:
 * - CEE (Certificats d'Économies d'Énergie) - BAR-TH-171 2026
 * - MaPrimeRénov' 2026 (Barème 2026 avec plafonds)
 * - MaPrimeRénov' Copropriété
 * - Bonus de remplacement (Fioul, Charbon, Gaz)
 * - Écrêtement CEE + MPR
 *
 * Formulaire complet CEDEO:
 * - 4 catégories de projets (Maison/Appartement/Collectif/Entreprise)
 * - Tous les champs techniques détaillés
 * - Tooltips et explications complètes (HowItWorks)
 * - Export PDF professionnel
 * ============================================================
 */

import React from 'react';
import SubsidyModeSelector from '../components/subsidy/SubsidyModeSelector';
import './CalculateurAidesView.css';

/**
 * Calculateur d'Aides - Point d'entrée principal
 * Affiche le système complet de calcul des primes (style CEDEO)
 *
 * Navigation:
 * 1. ProjectTypeSelector → Choix Maison/Appartement/Collectif/Entreprise
 * 2. SubsidyCalculator (Individuel) → Formulaire 7 étapes complet
 *    OU SubsidyCoproCalculator (Collectif) → Formulaire 4 étapes
 * 3. SubsidyResult / SubsidyCoproResult → Résultats détaillés + Export PDF
 */
function CalculateurAidesView() {
  return (
    <div className="calculateur-aides-page">
      <SubsidyModeSelector />
    </div>
  );
}

export default CalculateurAidesView;
