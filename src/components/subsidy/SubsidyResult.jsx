// src/components/subsidy/SubsidyResult.jsx
// Affichage des résultats de calcul des primes CEE/MaPrimeRénov'

import React, { useState } from 'react';
import { RESOURCE_THRESHOLDS } from '../../utils/subsidyData';
import { exportToPDF, preparePDFExport } from '../../utils/pdfExport';
import LegalNotices from './LegalNotices';
import './SubsidyCalculator.css';

const SubsidyResult = ({ result, formData, onBack, onReset, onRefine }) => {
  const [showRefinement, setShowRefinement] = useState(!formData.rfr || !formData.household_size);
  const [householdSize, setHouseholdSize] = useState(formData.household_size || 1);
  const [rfr, setRfr] = useState(formData.rfr || '');

  // Gestion export PDF
  const handlePDFExport = () => {
    const pdfData = preparePDFExport({
      type: 'individual',
      title: 'Estimation Primes Énergétiques - Logement Individuel',
      data: formData,
    });

    exportToPDF(pdfData.metadata.title, {
      filename: pdfData.filename,
    });
  };

  // Si non éligible
  if (!result.eligible) {
    return (
      <div className="subsidy-result ineligible">
        <div className="result-header">
          <h2>❌ Projet non éligible</h2>
        </div>

        <div className="ineligibility-reasons">
          <h3>Raisons de non-éligibilité :</h3>
          <ul>
            {result.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="result-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            ← Modifier les informations
          </button>
          <button className="btn btn-secondary" onClick={onReset}>
            🔄 Recommencer
          </button>
        </div>
      </div>
    );
  }

  // Affichage des 4 scénarios
  const renderScenarioTable = () => {
    return (
      <div className="scenarios-table">
        <h3>Estimation de la prime totale</h3>

        <table>
          <thead>
            <tr>
              <th></th>
              <th>Prime Énergie<br/>Très modeste</th>
              <th>Prime Énergie<br/>Modeste</th>
              <th>Prime Énergie<br/>Classique</th>
              <th>Prime Énergie<br/>Classique</th>
            </tr>
            <tr>
              <th></th>
              <th>MaPrimeRénov'<br/>Bleu</th>
              <th>MaPrimeRénov'<br/>Jaune</th>
              <th>MaPrimeRénov'<br/>Violet</th>
              <th>MaPrimeRénov'<br/>Rose</th>
            </tr>
          </thead>
          <tbody>
            <tr className="amount-row prime-energie">
              <td className="label-cell">Prime Énergie</td>
              {result.scenarios.map((scenario, idx) => (
                <td key={idx} className="amount-cell">
                  {scenario.cee.toFixed(2)} €
                </td>
              ))}
            </tr>
            <tr className="amount-row maprime-renov">
              <td className="label-cell">MaPrimeRénov'</td>
              {result.scenarios.map((scenario, idx) => (
                <td key={idx} className="amount-cell">
                  {scenario.mpr.toFixed(2)} €
                </td>
              ))}
            </tr>
            <tr className="total-row">
              <td className="label-cell"><strong>Total</strong></td>
              {result.scenarios.map((scenario, idx) => (
                <td key={idx} className="amount-cell total">
                  <strong>{scenario.total_after_ceiling.toFixed(2)} €</strong>
                </td>
              ))}
            </tr>
            <tr className="ceiling-row">
              <td className="label-cell">Écrêtement</td>
              {result.scenarios.map((scenario, idx) => (
                <td key={idx} className="info-cell">
                  Prise en charge max<br/>
                  <strong>{scenario.ceiling_rate}%</strong><br/>
                  max de la dépense éligible
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Affichage des plafonds de ressources
  const renderResourceThresholds = () => {
    const isIDF = ['75', '77', '78', '91', '92', '93', '94', '95'].includes(formData.postal_code.substring(0, 2));
    const thresholds = isIDF ? RESOURCE_THRESHOLDS.idf : RESOURCE_THRESHOLDS.other;

    return (
      <div className="resource-thresholds">
        <h4>Détails des plafonds de ressources</h4>
        <p>Zone : <strong>{isIDF ? 'Île-de-France' : 'Autres régions'}</strong></p>

        <table className="thresholds-table">
          <thead>
            <tr>
              <th>Nombre de personnes</th>
              <th>Bleu (Très modeste)</th>
              <th>Jaune (Modeste)</th>
              <th>Violet (Intermédiaire)</th>
              <th>Rose (Supérieur)</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((nb, idx) => (
              <tr key={nb} className={householdSize === nb ? 'highlighted' : ''}>
                <td>{nb}</td>
                <td>≤ {thresholds.blue[idx].toLocaleString()} €</td>
                <td>≤ {thresholds.yellow[idx].toLocaleString()} €</td>
                <td>≤ {thresholds.violet[idx].toLocaleString()} €</td>
                <td>&gt; {thresholds.violet[idx].toLocaleString()} €</td>
              </tr>
            ))}
            <tr>
              <td colSpan="5" className="note">
                Par personne supplémentaire : ajouter {thresholds.blue[4] - thresholds.blue[3]} € (Bleu), {thresholds.yellow[4] - thresholds.yellow[3]} € (Jaune), {thresholds.violet[4] - thresholds.violet[3]} € (Violet)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Affichage du formulaire d'affinage
  const renderRefinementForm = () => {
    if (!showRefinement) {
      return (
        <div className="refinement-prompt">
          <p>Afin de déterminer avec précision le montant de la prime, vous pouvez :</p>
          <div className="refinement-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowRefinement(true)}
            >
              Déclarer les revenus
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowRefinement(false)}
            >
              Passer cette étape
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="refinement-form">
        <h3>Affiner le calcul</h3>

        <div className="form-group">
          <label>Quel est le nombre de personnes vivant dans le foyer ?</label>
          <div className="counter">
            <button
              onClick={() => setHouseholdSize(Math.max(1, householdSize - 1))}
              className="counter-btn"
            >
              -
            </button>
            <span className="counter-value">{householdSize}</span>
            <button
              onClick={() => setHouseholdSize(householdSize + 1)}
              className="counter-btn"
            >
              +
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Quel est le revenu fiscal de référence TOTAL du foyer ?</label>
          <input
            type="number"
            className="form-input"
            value={rfr}
            onChange={(e) => setRfr(e.target.value)}
            placeholder="30000"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={() => onRefine(parseFloat(rfr), householdSize)}
          disabled={!rfr || rfr <= 0}
        >
          Valider
        </button>
      </div>
    );
  };

  // Affichage de la prime recommandée
  const renderRecommendedSubsidy = () => {
    if (!result.recommended_scenario) {
      return null;
    }

    const scenario = result.recommended_scenario;

    return (
      <div className="recommended-subsidy">
        <div className="subsidy-card">
          <div className="subsidy-header">
            <h2>Votre simulateur</h2>
            <p className="project-name">PAC Pompe à chaleur de type air/eau</p>
          </div>

          <div className="subsidy-amount">
            <p className="amount-label">Prime pour ce projet</p>
            <h1 className="amount-value">{scenario.total_after_ceiling.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € *</h1>
            <button className="btn btn-success btn-large">Je veux cette prime</button>
          </div>

          <div className="subsidy-info">
            <p className="info-icon">ℹ️</p>
            <p className="info-text">
              La somme totale des aides cumulées (CEE + MaPrimeRénov') ne peut dépasser <strong>{scenario.ceiling_rate}%</strong> du coût des équipements (fourniture et pose)
            </p>
          </div>

          <div className="subsidy-details">
            <p className="disclaimer">
              Versement de la prime uniquement si les travaux sont réalisés.<br/>
              Montant maximum indicatif, calculé hors écrêtement (applicable sur MaPrimeRénov') et plafond de dépense éligible.
            </p>

            <ul className="breakdown">
              <li>
                <span className="breakdown-label">Prime Énergie (CEE) {scenario.id}</span>
                <span className="breakdown-amount">{scenario.cee.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </li>
              <li>
                <span className="breakdown-label">MaPrimeRénov' ** (simulé) {scenario.mpr_label.split(' ')[1]}</span>
                <span className="breakdown-amount">{scenario.mpr.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </li>
              <li className="total">
                <span className="breakdown-label"><strong>Total</strong></span>
                <span className="breakdown-amount"><strong>{scenario.total_after_ceiling.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong></span>
              </li>
            </ul>

            {scenario.ceiling.reduction > 0 && (
              <div className="ceiling-notice">
                <p>⚠️ Écrêtement appliqué : {scenario.ceiling.reduction.toFixed(2)} € déduits pour respecter le plafond de {scenario.ceiling_rate}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="subsidy-result">
      <div className="result-header">
        <h2>✅ Éligibilité de votre client</h2>
        <div className="eligibility-info">
          <ul>
            {result.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          <p className="climate-info">Zone climatique : <strong>{result.climate_zone}</strong></p>
        </div>
      </div>

      {/* Tableau des 4 scénarios */}
      {renderScenarioTable()}

      {/* Plafonds de ressources */}
      {renderResourceThresholds()}

      {/* Formulaire d'affinage */}
      {!result.recommended_scenario && renderRefinementForm()}

      {/* Prime recommandée */}
      {result.recommended_scenario && renderRecommendedSubsidy()}

      {/* Mentions légales */}
      <LegalNotices calculationType="individual" generatedDate={new Date()} />

      {/* Actions */}
      <div className="result-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Retour
        </button>
        <button className="btn btn-secondary" onClick={onReset}>
          🔄 Nouveau calcul
        </button>
        <button className="btn btn-primary" onClick={handlePDFExport}>
          📄 Exporter PDF
        </button>
      </div>
    </div>
  );
};

export default SubsidyResult;
