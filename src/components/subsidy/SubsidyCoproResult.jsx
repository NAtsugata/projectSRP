// src/components/subsidy/SubsidyCoproResult.jsx
// Affichage des résultats MaPrimeRénov' Copropriété

import React from 'react';
import './SubsidyCalculator.css';

const SubsidyCoproResult = ({ result, formData, onBack, onReset }) => {
  if (!result.eligible) {
    return (
      <div className="subsidy-result ineligible">
        <div className="result-header">
          <h2>❌ Copropriété non éligible</h2>
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

  const formatAmount = (amount) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="subsidy-result copro-result">
      <div className="result-header">
        <h2>✅ Copropriété éligible à MaPrimeRénov' Copropriété</h2>
        <div className="eligibility-info">
          <ul>
            {result.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          <p className="climate-info">
            Zone climatique : <strong>{result.climate_zone}</strong> |
            Nombre de logements : <strong>{result.housing_count}</strong>
          </p>
        </div>
      </div>

      {/* Carte résultat principal */}
      <div className="recommended-subsidy">
        <div className="subsidy-card copro-card">
          <div className="subsidy-header">
            <h2>🏢 Aides Totales pour la Copropriété</h2>
            <p className="project-name">
              Travaux : {formatAmount(result.total_cost)} € |
              Taux d'aide : <strong>{result.total_rate}%</strong>
            </p>
          </div>

          <div className="subsidy-amount">
            <p className="amount-label">Aide collective</p>
            <h1 className="amount-value">{formatAmount(result.total_collective)} €</h1>
            <p className="amount-sublabel">
              Soit {formatAmount(result.per_housing.collective)} € / logement
            </p>

            {result.individual_bonuses.total > 0 && (
              <>
                <p className="amount-label" style={{ marginTop: '20px' }}>
                  + Aides individuelles copropriétaires
                </p>
                <h2 className="amount-value" style={{ fontSize: '32px' }}>
                  {formatAmount(result.individual_bonuses.total)} €
                </h2>
              </>
            )}

            {result.cee.total > 0 && (
              <>
                <p className="amount-label" style={{ marginTop: '20px' }}>
                  + Prime CEE estimée
                </p>
                <h2 className="amount-value" style={{ fontSize: '32px' }}>
                  {formatAmount(result.cee.total)} €
                </h2>
              </>
            )}

            <div style={{ borderTop: '2px solid rgba(255,255,255,0.3)', margin: '20px 0', paddingTop: '20px' }}>
              <p className="amount-label"><strong>TOTAL DES AIDES</strong></p>
              <h1 className="amount-value" style={{ fontSize: '48px' }}>
                {formatAmount(result.total_with_cee)} €
              </h1>
              <p className="amount-sublabel">
                Soit {formatAmount(result.per_housing.with_cee)} € / logement
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Détails de l'aide de base */}
      <div className="subsidy-details-section">
        <h3>📊 Détails de l'aide collective ({result.base_help.rate}%)</h3>
        <div className="details-card">
          <div className="detail-row">
            <span>Aide de base (25% des travaux)</span>
            <span className="detail-amount">{formatAmount(result.base_help.amount)} €</span>
          </div>
          <div className="detail-row">
            <span>Plafond par logement</span>
            <span className="detail-amount">{formatAmount(COPRO_MAX_PER_HOUSING)} €</span>
          </div>
          <div className="detail-row">
            <span>Par logement</span>
            <span className="detail-amount">{formatAmount(result.base_help.per_housing)} €</span>
          </div>
        </div>
      </div>

      {/* Bonus collectifs */}
      {Object.keys(result.collective_bonuses.bonuses).length > 0 && (
        <div className="subsidy-details-section">
          <h3>🎁 Bonus collectifs (+{result.collective_bonuses.total_rate}%)</h3>
          <div className="details-card">
            {Object.entries(result.collective_bonuses.bonuses).map(([key, bonus]) => (
              <div key={key} className="detail-row">
                <span>
                  {bonus.label}
                  <span className="detail-rate"> (+{bonus.rate}%)</span>
                </span>
                <span className="detail-amount">{formatAmount(bonus.amount)} €</span>
              </div>
            ))}
            <div className="detail-row total">
              <span><strong>Total bonus</strong></span>
              <span className="detail-amount"><strong>{formatAmount(result.collective_bonuses.total_amount)} €</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Aides individuelles */}
      {result.individual_bonuses.total > 0 && (
        <div className="subsidy-details-section">
          <h3>👥 Aides individuelles par copropriétaire</h3>
          <div className="details-card">
            <div className="detail-row">
              <span>
                <strong>Bleu</strong> (Très modeste) - {result.individual_bonuses.breakdown.blue.count} logements
              </span>
              <span className="detail-amount">
                {result.individual_bonuses.breakdown.blue.amount_per_housing} € × {result.individual_bonuses.breakdown.blue.count} =
                <strong> {formatAmount(result.individual_bonuses.breakdown.blue.total)} €</strong>
              </span>
            </div>
            <div className="detail-row">
              <span>
                <strong>Jaune</strong> (Modeste) - {result.individual_bonuses.breakdown.yellow.count} logements
              </span>
              <span className="detail-amount">
                {result.individual_bonuses.breakdown.yellow.amount_per_housing} € × {result.individual_bonuses.breakdown.yellow.count} =
                <strong> {formatAmount(result.individual_bonuses.breakdown.yellow.total)} €</strong>
              </span>
            </div>
            <div className="detail-row">
              <span>
                <strong>Violet</strong> (Intermédiaire) - {result.individual_bonuses.breakdown.violet.count} logements
              </span>
              <span className="detail-amount">0 €</span>
            </div>
            <div className="detail-row">
              <span>
                <strong>Rose</strong> (Supérieur) - {result.individual_bonuses.breakdown.rose.count} logements
              </span>
              <span className="detail-amount">0 €</span>
            </div>
            <div className="detail-row total">
              <span><strong>Total aides individuelles</strong></span>
              <span className="detail-amount"><strong>{formatAmount(result.individual_bonuses.total)} €</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* CEE */}
      {result.cee.total > 0 && (
        <div className="subsidy-details-section">
          <h3>⚡ Prime CEE (Certificats d'Économies d'Énergie)</h3>
          <div className="details-card">
            <div className="detail-row">
              <span>Zone climatique</span>
              <span className="detail-amount">{result.cee.zone}</span>
            </div>
            <div className="detail-row">
              <span>Par logement</span>
              <span className="detail-amount">{formatAmount(result.cee.per_housing)} €</span>
            </div>
            <div className="detail-row total">
              <span><strong>Total CEE</strong></span>
              <span className="detail-amount"><strong>{formatAmount(result.cee.total)} €</strong></span>
            </div>
            <p className="hint" style={{ marginTop: '10px' }}>{result.cee.note}</p>
          </div>
        </div>
      )}

      {/* Accompagnement */}
      <div className="subsidy-details-section">
        <h3>🤝 Accompagnement Mon Accompagnateur Rénov'</h3>
        <div className="details-card">
          <div className="detail-row">
            <span>Taux de prise en charge</span>
            <span className="detail-amount">{result.accompaniment.coverage_rate}%</span>
          </div>
          <div className="detail-row">
            <span>Maximum par logement</span>
            <span className="detail-amount">{result.accompaniment.max_per_housing} € HT</span>
          </div>
          <div className="detail-row total">
            <span><strong>Maximum total</strong></span>
            <span className="detail-amount"><strong>{formatAmount(result.accompaniment.total_max)} € HT</strong></span>
          </div>
          <p className="hint" style={{ marginTop: '10px' }}>
            {result.accompaniment.is_large_copro
              ? '> 50 logements : 420 € HT / logement'
              : '≤ 50 logements : 600 € HT / logement'}
          </p>
        </div>
      </div>

      {/* Reste à charge */}
      <div className="subsidy-details-section">
        <h3>💰 Reste à charge</h3>
        <div className="details-card" style={{ background: '#fff3cd' }}>
          <div className="detail-row">
            <span><strong>Coût total des travaux</strong></span>
            <span className="detail-amount"><strong>{formatAmount(result.total_cost)} €</strong></span>
          </div>
          <div className="detail-row">
            <span><strong>Total des aides</strong></span>
            <span className="detail-amount"><strong>- {formatAmount(result.total_with_cee)} €</strong></span>
          </div>
          <div className="detail-row total" style={{ borderTop: '2px solid #856404', paddingTop: '10px' }}>
            <span><strong>Reste à charge copropriété</strong></span>
            <span className="detail-amount"><strong>{formatAmount(result.remaining_cost)} €</strong></span>
          </div>
          <div className="detail-row">
            <span>Soit par logement</span>
            <span className="detail-amount">{formatAmount(result.remaining_per_housing)} €</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="result-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Retour
        </button>
        <button className="btn btn-secondary" onClick={onReset}>
          🔄 Nouveau calcul
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ Imprimer
        </button>
      </div>
    </div>
  );
};

// Importer COPRO_MAX_PER_HOUSING pour l'affichage
import { COPRO_MAX_PER_HOUSING } from '../../utils/subsidyCoproData';

export default SubsidyCoproResult;
