/**
 * ============================================================
 * CALCULATEUR D'AIDES ÉTAT 2026
 * ============================================================
 * Calcule automatiquement les aides disponibles pour:
 * - MaPrimeRénov'
 * - CEE (Certificats d'Économies d'Énergie)
 * - Coup de Pouce Chauffage
 *
 * Pour installations: Pompes à chaleur (Qualipac RGE)
 * ============================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  calculerTotalAides,
  CATEGORIES_LABELS,
  CONDITIONS_MPR,
  CONDITIONS_CEE,
  PERFORMANCES_MINIMALES
} from '../utils/aidesBaremes';
import './CalculateurAidesView.css';

// Icônes SVG
const CalculatorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <line x1="8" y1="6" x2="16" y2="6"/>
    <line x1="8" y1="10" x2="16" y2="10"/>
    <line x1="8" y1="14" x2="12" y2="14"/>
    <line x1="8" y1="18" x2="12" y2="18"/>
  </svg>
);

const EuroIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14z"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

function CalculateurAidesView() {
  // État du formulaire
  const [formData, setFormData] = useState({
    typePAC: 'AIR_EAU',
    rfr: '',
    nbPersonnes: 2,
    isIDF: false,
    surfaceChauffee: 100,
    montantTravaux: '',
    ancienneteLogement: 15,
    avecCoupDePouce: true,
    remplacementChauffage: true,
    residencePrincipale: true,
    estProprietaire: true
  });

  // Résultats du calcul
  const [resultats, setResultats] = useState(null);
  const [showConditions, setShowConditions] = useState(false);

  // Calculer automatiquement quand les données changent
  useEffect(() => {
    if (formData.rfr && formData.montantTravaux) {
      const params = {
        typePAC: formData.typePAC,
        rfr: parseFloat(formData.rfr),
        nbPersonnes: parseInt(formData.nbPersonnes),
        isIDF: formData.isIDF,
        surfaceChauffee: parseInt(formData.surfaceChauffee),
        montantTravaux: parseFloat(formData.montantTravaux),
        ancienneteLogement: parseInt(formData.ancienneteLogement),
        avecCoupDePouce: formData.avecCoupDePouce
      };

      const resultatsCalcul = calculerTotalAides(params);
      setResultats(resultatsCalcul);
    } else {
      setResultats(null);
    }
  }, [formData]);

  // Gérer les changements de formulaire
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Vérifier l'éligibilité
  const eligibilite = useMemo(() => {
    const checks = {
      anciennete: formData.ancienneteLogement >= CONDITIONS_MPR.anciennete_logement,
      residencePrincipale: formData.residencePrincipale,
      proprietaire: formData.estProprietaire,
      pacEligible: formData.typePAC !== 'AIR_AIR'
    };

    checks.eligible = Object.values(checks).every(v => v === true);
    return checks;
  }, [formData]);

  // Reste à charge (utilise le nouveau calcul)
  const resteACharge = useMemo(() => {
    if (!resultats) return 0;
    return resultats.resteACharge || 0;
  }, [resultats]);

  const resteAChargeAvecPret = useMemo(() => {
    if (!resultats) return 0;
    return resultats.resteAChargeAvecPret || 0;
  }, [resultats]);

  return (
    <div className="calculateur-aides-page">
      {/* Header */}
      <div className="calc-header">
        <div className="calc-header-content">
          <CalculatorIcon />
          <div>
            <h1>Calculateur d'Aides État 2026</h1>
            <p>MaPrimeRénov' + CEE + Coup de Pouce + Éco-PTZ + TVA 5.5%</p>
          </div>
        </div>
      </div>

      <div className="calc-container">
        {/* Formulaire */}
        <div className="calc-form-section">
          <div className="calc-card">
            <h2>📋 Informations du projet</h2>

            {/* Type de PAC */}
            <div className="form-group">
              <label>Type de pompe à chaleur</label>
              <select
                value={formData.typePAC}
                onChange={(e) => handleChange('typePAC', e.target.value)}
                className="form-select"
              >
                <option value="AIR_EAU">PAC Air/Eau (Aérothermie)</option>
                <option value="GEOTHERMIQUE">PAC Géothermique / Eau/Eau</option>
                <option value="AIR_AIR">PAC Air/Air (❌ Non éligible MPR)</option>
              </select>
            </div>

            {/* Montant des travaux */}
            <div className="form-group">
              <label>Montant total des travaux TTC (€)</label>
              <input
                type="number"
                value={formData.montantTravaux}
                onChange={(e) => handleChange('montantTravaux', e.target.value)}
                placeholder="Ex: 12000"
                className="form-input"
                min="0"
              />
            </div>

            {/* Surface chauffée */}
            <div className="form-group">
              <label>Surface chauffée (m²)</label>
              <input
                type="number"
                value={formData.surfaceChauffee}
                onChange={(e) => handleChange('surfaceChauffee', e.target.value)}
                className="form-input"
                min="1"
                max="300"
              />
              <small className="form-hint">Plafonné à 100 m² pour le calcul CEE</small>
            </div>

            <h2 className="section-title">👥 Votre situation</h2>

            {/* Revenu Fiscal de Référence */}
            <div className="form-group">
              <label>Revenu Fiscal de Référence 2025 (€)</label>
              <input
                type="number"
                value={formData.rfr}
                onChange={(e) => handleChange('rfr', e.target.value)}
                placeholder="Ex: 30000"
                className="form-input"
                min="0"
              />
              <small className="form-hint">RFR indiqué sur votre avis d'imposition 2025</small>
            </div>

            {/* Nombre de personnes */}
            <div className="form-group">
              <label>Nombre de personnes dans le foyer</label>
              <select
                value={formData.nbPersonnes}
                onChange={(e) => handleChange('nbPersonnes', e.target.value)}
                className="form-select"
              >
                <option value="1">1 personne</option>
                <option value="2">2 personnes</option>
                <option value="3">3 personnes</option>
                <option value="4">4 personnes</option>
                <option value="5">5 personnes ou plus</option>
              </select>
            </div>

            {/* Localisation */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isIDF}
                  onChange={(e) => handleChange('isIDF', e.target.checked)}
                />
                <span>Logement en Île-de-France</span>
              </label>
            </div>

            <h2 className="section-title">🏠 Caractéristiques du logement</h2>

            {/* Ancienneté */}
            <div className="form-group">
              <label>Ancienneté du logement (années)</label>
              <input
                type="number"
                value={formData.ancienneteLogement}
                onChange={(e) => handleChange('ancienneteLogement', e.target.value)}
                className="form-input"
                min="0"
              />
              <small className="form-hint">Minimum {CONDITIONS_MPR.anciennete_logement} ans pour MaPrimeRénov'</small>
            </div>

            {/* Checkboxes conditions */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.residencePrincipale}
                  onChange={(e) => handleChange('residencePrincipale', e.target.checked)}
                />
                <span>Résidence principale</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.estProprietaire}
                  onChange={(e) => handleChange('estProprietaire', e.target.checked)}
                />
                <span>Propriétaire du logement</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.remplacementChauffage}
                  onChange={(e) => handleChange('remplacementChauffage', e.target.checked)}
                />
                <span>Remplace un ancien système de chauffage</span>
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.avecCoupDePouce}
                  onChange={(e) => handleChange('avecCoupDePouce', e.target.checked)}
                />
                <span>Demander le Coup de Pouce Chauffage</span>
              </label>
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className="calc-results-section">
          {/* Éligibilité */}
          <div className={`calc-card eligibility-card ${eligibilite.eligible ? 'eligible' : 'not-eligible'}`}>
            <h2>✓ Éligibilité</h2>
            <div className="eligibility-checks">
              <div className={`check-item ${eligibilite.anciennete ? 'valid' : 'invalid'}`}>
                {eligibilite.anciennete ? <CheckIcon /> : '✗'}
                <span>Logement ≥ {CONDITIONS_MPR.anciennete_logement} ans</span>
              </div>
              <div className={`check-item ${eligibilite.residencePrincipale ? 'valid' : 'invalid'}`}>
                {eligibilite.residencePrincipale ? <CheckIcon /> : '✗'}
                <span>Résidence principale</span>
              </div>
              <div className={`check-item ${eligibilite.proprietaire ? 'valid' : 'invalid'}`}>
                {eligibilite.proprietaire ? <CheckIcon /> : '✗'}
                <span>Propriétaire</span>
              </div>
              <div className={`check-item ${eligibilite.pacEligible ? 'valid' : 'invalid'}`}>
                {eligibilite.pacEligible ? <CheckIcon /> : '✗'}
                <span>PAC éligible MaPrimeRénov'</span>
              </div>
            </div>
          </div>

          {/* Résultats du calcul */}
          {resultats ? (
            <>
              {/* Catégorie */}
              <div className={`calc-card category-card category-${resultats.categorie.toLowerCase()}`}>
                <h3>📊 Votre catégorie</h3>
                <div className="category-badge">
                  {resultats.categorieLabel}
                </div>
              </div>

              {/* Aides détaillées */}
              <div className="calc-card aides-detail-card">
                <h2><EuroIcon /> Aides et économies disponibles</h2>

                <div className="aide-item">
                  <div className="aide-label">
                    <strong>MaPrimeRénov'</strong>
                    <span className="aide-desc">Subvention de l'État</span>
                  </div>
                  <div className="aide-montant">
                    {resultats.aides.maPrimeRenov.toLocaleString('fr-FR')} €
                  </div>
                </div>

                <div className="aide-item">
                  <div className="aide-label">
                    <strong>CEE {formData.avecCoupDePouce && '+ Coup de Pouce'}</strong>
                    <span className="aide-desc">Certificats d'Économies d'Énergie</span>
                  </div>
                  <div className="aide-montant">
                    {resultats.aides.cee.toLocaleString('fr-FR')} €
                  </div>
                </div>

                {resultats.aides.economieTVA > 0 && (
                  <div className="aide-item">
                    <div className="aide-label">
                      <strong>TVA réduite 5.5%</strong>
                      <span className="aide-desc">Économie fiscale (au lieu de 20%)</span>
                    </div>
                    <div className="aide-montant">
                      {resultats.aides.economieTVA.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                )}

                <div className="aide-subtotal" style={{borderTop: '2px solid var(--border-color)', paddingTop: '16px', marginTop: '12px'}}>
                  <div className="aide-label">
                    <strong>TOTAL SUBVENTIONS + TVA</strong>
                  </div>
                  <div className="aide-montant" style={{fontSize: '20px', fontWeight: '700', color: 'var(--color-primary)'}}>
                    {resultats.aides.totalAvecTVA.toLocaleString('fr-FR')} €
                  </div>
                </div>

                {resultats.aides.ecoPTZ > 0 && (
                  <div className="aide-item" style={{marginTop: '16px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px'}}>
                    <div className="aide-label">
                      <strong>Éco-PTZ disponible</strong>
                      <span className="aide-desc">Prêt à taux zéro (sans intérêts)</span>
                    </div>
                    <div className="aide-montant" style={{color: 'var(--color-secondary)'}}>
                      {resultats.aides.ecoPTZ.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                )}
              </div>

              {/* Reste à charge */}
              {formData.montantTravaux && (
                <div className="calc-card reste-charge-card">
                  <h2>💰 Financement détaillé</h2>
                  <div className="finance-row">
                    <span>Coût des travaux TTC</span>
                    <strong>{parseFloat(formData.montantTravaux).toLocaleString('fr-FR')} €</strong>
                  </div>
                  <div className="finance-row">
                    <span>Subventions (MaPrimeRénov' + CEE)</span>
                    <strong className="text-success">- {resultats.aides.totalSubventions.toLocaleString('fr-FR')} €</strong>
                  </div>
                  {resultats.aides.economieTVA > 0 && (
                    <div className="finance-row">
                      <span>Économie TVA (5.5% au lieu de 20%)</span>
                      <strong className="text-success">- {resultats.aides.economieTVA.toLocaleString('fr-FR')} €</strong>
                    </div>
                  )}
                  <div className="finance-row" style={{borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px', marginTop: '8px'}}>
                    <span>Reste à charge</span>
                    <strong className="text-primary">{resteACharge.toLocaleString('fr-FR')} €</strong>
                  </div>
                  {resultats.aides.ecoPTZ > 0 && (
                    <>
                      <div className="finance-row">
                        <span>Éco-PTZ (prêt à 0%)</span>
                        <strong style={{color: '#fbbf24'}}>- {resultats.aides.ecoPTZ.toLocaleString('fr-FR')} €</strong>
                      </div>
                      <div className="finance-row total-row">
                        <span><strong>Reste à payer comptant</strong></span>
                        <strong className="text-primary">{resteAChargeAvecPret.toLocaleString('fr-FR')} €</strong>
                      </div>
                    </>
                  )}
                  {resultats.tauxAide > 0 && (
                    <div className="taux-aide">
                      Taux d'aide: <strong>{resultats.tauxAide}%</strong>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="calc-card placeholder-card">
              <p>📝 Remplissez le formulaire pour calculer vos aides</p>
            </div>
          )}

          {/* Conditions et informations */}
          <div className="calc-card info-card">
            <button
              className="info-toggle"
              onClick={() => setShowConditions(!showConditions)}
            >
              <InfoIcon />
              <span>Conditions d'éligibilité</span>
              <span className={`arrow ${showConditions ? 'open' : ''}`}>▼</span>
            </button>

            {showConditions && (
              <div className="info-content">
                <h3>MaPrimeRénov'</h3>
                <ul>
                  <li>✓ Logement construit depuis ≥ {CONDITIONS_MPR.anciennete_logement} ans</li>
                  <li>✓ Résidence principale</li>
                  <li>✓ Propriétaire occupant</li>
                  <li>✓ Professionnel RGE (Qualipac)</li>
                  <li>✓ PAC performantes (ETAS ≥ {PERFORMANCES_MINIMALES.AIR_EAU.ETAS_MIN}%)</li>
                  <li>❌ PAC Air/Air NON éligible</li>
                </ul>

                <h3>CEE + Coup de Pouce</h3>
                <ul>
                  <li>✓ Remplacement système de chauffage existant</li>
                  <li>✓ Professionnel RGE</li>
                  <li>✓ Travaux débutés avant le 31/12/2026</li>
                  <li>✓ Travaux terminés avant le 31/12/2027</li>
                  <li>✓ ETAS ≥ {PERFORMANCES_MINIMALES.AIR_EAU.ETAS_OPTIMAL}% pour bonus maximal</li>
                </ul>

                <h3>⚠️ Important</h3>
                <ul>
                  <li>Les aides sont cumulables</li>
                  <li>Installation obligatoire par professionnel RGE Qualipac</li>
                  <li>Demander MaPrimeRénov' AVANT le début des travaux</li>
                  <li>Montants indicatifs - Vérifier sur les sites officiels</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalculateurAidesView;
