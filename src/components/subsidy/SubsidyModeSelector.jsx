// src/components/subsidy/SubsidyModeSelector.jsx
// Sélecteur Individuel / Copropriété

import React, { useState } from 'react';
import SubsidyCalculator from './SubsidyCalculator';
import SubsidyCoproCalculator from './SubsidyCoproCalculator';
import './SubsidyCalculator.css';

const SubsidyModeSelector = () => {
  const [mode, setMode] = useState(null); // null | 'individual' | 'copro'

  if (mode === 'individual') {
    return <SubsidyCalculator onBack={() => setMode(null)} />;
  }

  if (mode === 'copro') {
    return <SubsidyCoproCalculator onBack={() => setMode(null)} />;
  }

  return (
    <div className="subsidy-calculator mode-selector">
      <div className="calculator-header">
        <h2>Calculateur de Primes Énergétiques</h2>
        <p className="calculator-subtitle">
          CEE (Certificats d'Économies d'Énergie) + MaPrimeRénov'
        </p>
      </div>

      <div className="mode-selection">
        <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          Quel type de projet souhaitez-vous calculer ?
        </h3>

        <div className="mode-cards">
          <div
            className="mode-card"
            onClick={() => setMode('individual')}
            role="button"
            tabIndex={0}
          >
            <div className="mode-icon">🏠</div>
            <h4>Logement Individuel</h4>
            <p>
              Pour propriétaires occupants, bailleurs ou locataires
            </p>
            <ul className="mode-features">
              <li>✓ Maison individuelle</li>
              <li>✓ Appartement</li>
              <li>✓ PAC air/eau, isolation, etc.</li>
              <li>✓ Aides selon revenus du foyer</li>
            </ul>
            <button className="btn btn-primary">
              Calculer pour un logement individuel →
            </button>
          </div>

          <div
            className="mode-card"
            onClick={() => setMode('copro')}
            role="button"
            tabIndex={0}
          >
            <div className="mode-icon">🏢</div>
            <h4>Copropriété</h4>
            <p>
              Pour travaux sur parties communes
            </p>
            <ul className="mode-features">
              <li>✓ Immeuble en copropriété</li>
              <li>✓ Travaux collectifs</li>
              <li>✓ Aide de base 25% (sans condition de revenus)</li>
              <li>✓ Bonus individuels par copropriétaire</li>
            </ul>
            <button className="btn btn-primary">
              Calculer pour une copropriété →
            </button>
          </div>
        </div>

        <div className="mode-comparison">
          <h4>Principales différences :</h4>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Critère</th>
                <th>Logement Individuel</th>
                <th>Copropriété</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Aide de base</strong></td>
                <td>0 à 5 000 € selon revenus</td>
                <td>25% des travaux (max 25k€/logement)</td>
              </tr>
              <tr>
                <td><strong>Condition revenus</strong></td>
                <td>Obligatoire pour montant</td>
                <td>Aucune pour aide de base</td>
              </tr>
              <tr>
                <td><strong>Type de travaux</strong></td>
                <td>Logement individuel</td>
                <td>Parties communes</td>
              </tr>
              <tr>
                <td><strong>Accompagnement</strong></td>
                <td>Optionnel (recommandé)</td>
                <td>Obligatoire (100% pris en charge)</td>
              </tr>
              <tr>
                <td><strong>Gain énergétique</strong></td>
                <td>Pas de minimum</td>
                <td>Minimum 35%</td>
              </tr>
              <tr>
                <td><strong>Âge bâtiment</strong></td>
                <td>Plus de 2 ans</td>
                <td>Plus de 15 ans</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubsidyModeSelector;
