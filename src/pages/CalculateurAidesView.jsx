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
  calculerMaPrimeRenovCopro,
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

// Configuration des étapes du wizard
const WIZARD_STEPS = [
  { num: 1, title: 'Votre profil', icon: '👤' },
  { num: 2, title: 'Caractéristiques PAC', icon: '💨' },
  { num: 3, title: 'Configuration technique', icon: '⚙️' },
  { num: 4, title: 'Émetteurs & Remplacement', icon: '🔧' },
  { num: 5, title: 'Vos revenus', icon: '💰' },
  { num: 6, title: 'Résultats', icon: '✨' }
];

function CalculateurAidesView() {
  // État du formulaire - COMPLET STYLE CEDEO
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // ÉTAPE 1: PROFIL
    estProprietaire: true, // true = propriétaire, false = locataire
    ancienneteBatiment: 'PLUS_15_ANS', // MOINS_2_ANS, ENTRE_2_15_ANS, PLUS_15_ANS
    codePostal: '',
    zoneClimatique: 'H1', // H1 (Nord), H2 (Centre), H3 (Sud)
    typeProjet: 'INDIVIDUEL', // INDIVIDUEL ou COPROPRIETE

    // ÉTAPE 2: CARACTÉRISTIQUES PAC
    typePAC: 'AIR_EAU', // AIR_EAU, GEOTHERMIQUE, AIR_AIR
    surfaceChauffee: '',
    typeApplication: 'BASSE_TEMPERATURE', // BASSE, MOYENNE, HAUTE
    usagePAC: 'CHAUFFAGE_ECS', // CHAUFFAGE, CHAUFFAGE_ECS, AUTRE

    // ÉTAPE 3: CONFIGURATION TECHNIQUE
    avecRegulateur: true,
    etas: '', // % - Efficacité énergétique saisonnière
    puissanceNominale: '', // kW
    associationAutreSysteme: false,

    // ÉTAPE 4: ÉMETTEURS ET REMPLACEMENT
    typeEmetteurs: 'PLANCHER_CHAUFFANT', // PLANCHER_CHAUFFANT, MIXTES, RADIATEURS
    systemeDeporteECS: false,
    typeRemplacementChaudiere: 'FIOUL', // CHARBON, FIOUL, GAZ, ELECTRIQUE, AUTRE, AUCUN

    // ÉTAPE 5: REVENUS (si individuel)
    rfr: '',
    nbPersonnes: 2,
    isIDF: false,

    // AUTRES
    montantTravaux: '',
    avecCoupDePouce: true,

    // Champs spécifiques copropriété (si applicable)
    nbLogements: 10,
    gainEnergetique: 35,
    sortiePassoire: false,
    coproFragile: false,
    nbCoproModestes: 0,
    nbCoproTresModestes: 0
  });

  // Résultats du calcul
  const [resultats, setResultats] = useState(null);
  const [showConditions, setShowConditions] = useState(false);

  // Calculer automatiquement quand les données changent
  useEffect(() => {
    if (formData.montantTravaux) {
      // COPROPRIÉTÉ - Calcul spécifique
      if (formData.typeProjet === 'COPROPRIETE') {
        const montantHT = parseFloat(formData.montantTravaux) / 1.055; // Estimation HT avec TVA 5.5%

        const resultatscopro = calculerMaPrimeRenovCopro({
          montantTravauxHT: montantHT,
          nbLogements: parseInt(formData.nbLogements),
          gainEnergetique: parseFloat(formData.gainEnergetique) / 100,
          sortiePassoire: formData.sortiePassoire,
          coproFragile: formData.coproFragile,
          nbCoproprietairesModestes: parseInt(formData.nbCoproModestes),
          nbCoproprietairesTresModestes: parseInt(formData.nbCoproTresModestes)
        });

        // Format compatible avec l'affichage
        setResultats({
          isCopropriete: true,
          categorie: 'copropriete', // Pour la classe CSS
          categorieLabel: 'Copropriété',
          aides: {
            maPrimeRenov: resultatscopro.aideCollective,
            primesIndividuelles: resultatscopro.primesIndividuelles,
            cee: 0, // Pas de CEE pour copro dans ce calcul simplifié
            ecoPTZ: 0,
            economieTVA: parseFloat(formData.montantTravaux) * 0.145 / 1.20,
            totalSubventions: resultatscopro.total,
            totalAvecTVA: resultatscopro.total + (parseFloat(formData.montantTravaux) * 0.145 / 1.20)
          },
          detailsCopro: resultatscopro.details,
          resteACharge: parseFloat(formData.montantTravaux) - resultatscopro.total,
          tauxAide: Math.round((resultatscopro.total / parseFloat(formData.montantTravaux)) * 100)
        });
      }
      // INDIVIDUEL - Calcul standard
      else if (formData.rfr) {
        const params = {
          typePAC: formData.typePAC,
          rfr: parseFloat(formData.rfr),
          nbPersonnes: parseInt(formData.nbPersonnes),
          isIDF: formData.isIDF,
          surfaceChauffee: parseInt(formData.surfaceChauffee) || 100,
          zoneClimatique: formData.zoneClimatique || 'H1',                          // NOUVEAU 2026
          etas: parseFloat(formData.etas) || 126,                                    // NOUVEAU 2026
          typeRemplacementChaudiere: formData.typeRemplacementChaudiere || 'AUCUN', // NOUVEAU 2026
          montantTravaux: parseFloat(formData.montantTravaux),
          ancienneteLogement: parseInt(formData.ancienneteLogement),
          avecCoupDePouce: formData.avecCoupDePouce
        };

        const resultatsCalcul = calculerTotalAides(params);
        setResultats({...resultatsCalcul, isCopropriete: false});
      } else {
        setResultats(null);
      }
    } else {
      setResultats(null);
    }
  }, [formData]);

  // Gérer les changements de formulaire
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Navigation wizard
  const goToNextStep = () => {
    // Sauter l'étape revenus si copropriété
    if (currentStep === 4 && formData.typeProjet === 'COPROPRIETE') {
      setCurrentStep(6); // Aller directement aux résultats
    } else {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    }
  };

  const goToPreviousStep = () => {
    // Revenir de résultats si copropriété
    if (currentStep === 6 && formData.typeProjet === 'COPROPRIETE') {
      setCurrentStep(4); // Revenir à émetteurs
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
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

            {/* TYPE DE PROJET - NOUVEAU ! */}
            <div className="form-group">
              <label style={{fontSize: '16px', fontWeight: '700', color: 'var(--color-primary)'}}>
                🏠 Type de projet
              </label>
              <select
                value={formData.typeProjet}
                onChange={(e) => handleChange('typeProjet', e.target.value)}
                className="form-select"
                style={{borderColor: 'var(--color-primary)', borderWidth: '2px'}}
              >
                <option value="INDIVIDUEL">🏡 Maison ou Appartement individuel</option>
                <option value="COPROPRIETE">🏢 Copropriété (parties communes)</option>
              </select>
              <small className="form-hint">
                {formData.typeProjet === 'COPROPRIETE'
                  ? '✅ Calcul spécial MaPrimeRénov\' Copropriété activé'
                  : 'Pour travaux individuels (maison ou appartement)'}
              </small>
            </div>

            {/* ZONE CLIMATIQUE - IMPORTANT POUR CEE 2026 ! */}
            <div className="form-group">
              <label style={{fontSize: '16px', fontWeight: '700', color: 'var(--color-primary)'}}>
                🌡️ Zone climatique (CEE 2026)
              </label>
              <select
                value={formData.zoneClimatique}
                onChange={(e) => handleChange('zoneClimatique', e.target.value)}
                className="form-select"
                style={{borderColor: 'var(--color-primary)', borderWidth: '2px'}}
              >
                <option value="H1">H1 - Nord / Est (+ froid)</option>
                <option value="H2">H2 - Centre / Ouest (tempéré)</option>
                <option value="H3">H3 - Sud / Méditerranée (+ chaud)</option>
              </select>
              <small className="form-hint">
                ℹ️ Impact direct sur le calcul CEE (barème BAR-TH-171)
              </small>
            </div>

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

            {/* ===== SECTION TECHNIQUE PAC (CEE 2026) ===== */}
            <h2 className="section-title" style={{color: 'var(--color-primary)', marginTop: '30px'}}>
              ⚙️ Caractéristiques techniques de la PAC
            </h2>

            {/* ETAS - OBLIGATOIRE CEE 2026 */}
            <div className="form-group">
              <label style={{fontWeight: '700'}}>
                📊 ETAS - Efficacité Énergétique Saisonnière (%)
                <span style={{color: 'red'}}> *</span>
              </label>
              <input
                type="number"
                value={formData.etas}
                onChange={(e) => handleChange('etas', e.target.value)}
                className="form-input"
                min="111"
                max="250"
                placeholder="Ex: 126"
                style={{
                  borderColor: formData.etas && parseFloat(formData.etas) < 111 ? 'red' : 'var(--color-primary)',
                  borderWidth: '2px'
                }}
              />
              <small className="form-hint" style={{
                color: formData.etas && parseFloat(formData.etas) < 111 ? 'red' : 'inherit'
              }}>
                {formData.etas && parseFloat(formData.etas) < 111
                  ? '❌ ETAS minimum requis : 111% (CEE 2026)'
                  : '✅ Minimum : 111% | Bonus si ≥ 140% ou ≥ 200%'}
              </small>
            </div>

            {/* Type de remplacement - IMPORTANT POUR COUP DE POUCE */}
            <div className="form-group">
              <label style={{fontWeight: '700'}}>
                🔄 Remplacement d'une ancienne chaudière ?
              </label>
              <select
                value={formData.typeRemplacementChaudiere}
                onChange={(e) => handleChange('typeRemplacementChaudiere', e.target.value)}
                className="form-select"
                style={{borderColor: 'var(--color-primary)', borderWidth: '2px'}}
              >
                <option value="AUCUN">Aucun remplacement</option>
                <option value="FIOUL">🛢️ Chaudière FIOUL (Bonus MPR + CEE)</option>
                <option value="GAZ">🔥 Chaudière GAZ (CEE uniquement)</option>
                <option value="CHARBON">⚫ Chaudière CHARBON (CEE uniquement)</option>
                <option value="ELECTRIQUE">⚡ Chaudière ÉLECTRIQUE (CEE uniquement)</option>
              </select>
              <small className="form-hint">
                {formData.typeRemplacementChaudiere === 'FIOUL'
                  ? '✅ Bonus dépose fioul : +400€ à +1200€ selon revenus (MPR)'
                  : formData.typeRemplacementChaudiere !== 'AUCUN'
                  ? '✅ Coup de Pouce Chauffage activé (CEE x5)'
                  : 'ℹ️ Coup de Pouce réservé aux remplacements de chaudières fossiles'}
              </small>
            </div>

            {/* CHAMPS SPÉCIFIQUES COPROPRIÉTÉ */}
            {formData.typeProjet === 'COPROPRIETE' && (
              <>
                <h2 className="section-title" style={{color: 'var(--color-primary)'}}>🏢 Informations Copropriété</h2>

                <div className="form-group">
                  <label>Nombre de logements dans la copropriété</label>
                  <input
                    type="number"
                    value={formData.nbLogements}
                    onChange={(e) => handleChange('nbLogements', e.target.value)}
                    className="form-input"
                    min="2"
                  />
                </div>

                <div className="form-group">
                  <label>Gain énergétique prévu (%)</label>
                  <input
                    type="number"
                    value={formData.gainEnergetique}
                    onChange={(e) => handleChange('gainEnergetique', e.target.value)}
                    className="form-input"
                    min="15"
                    max="100"
                  />
                  <small className="form-hint">
                    Minimum 35% requis - 45% pour taux bonifié - 50% pour taux maximal
                  </small>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.sortiePassoire}
                      onChange={(e) => handleChange('sortiePassoire', e.target.checked)}
                    />
                    <span>Sortie de passoire thermique (F/G → A-D) <strong style={{color: 'var(--color-primary)'}}>+10%</strong></span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.coproFragile}
                      onChange={(e) => handleChange('coproFragile', e.target.checked)}
                    />
                    <span>Copropriété fragile (impayés ≥ 8%) <strong style={{color: 'var(--color-primary)'}}>+20%</strong></span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Nb copropriétaires revenus très modestes (prime 3000€)</label>
                  <input
                    type="number"
                    value={formData.nbCoproTresModestes}
                    onChange={(e) => handleChange('nbCoproTresModestes', e.target.value)}
                    className="form-input"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Nb copropriétaires revenus modestes (prime 1500€)</label>
                  <input
                    type="number"
                    value={formData.nbCoproModestes}
                    onChange={(e) => handleChange('nbCoproModestes', e.target.value)}
                    className="form-input"
                    min="0"
                  />
                </div>
              </>
            )}

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
              <div className={`calc-card category-card category-${resultats.categorie?.toLowerCase() || 'default'}`}>
                <h3>📊 {resultats.isCopropriete ? 'Type de projet' : 'Votre catégorie'}</h3>
                <div className="category-badge">
                  {resultats.categorieLabel}
                </div>
              </div>

              {/* Aides détaillées */}
              <div className="calc-card aides-detail-card">
                <h2><EuroIcon /> Aides et économies disponibles</h2>

                {/* AFFICHAGE COPROPRIÉTÉ */}
                {resultats.isCopropriete ? (
                  <>
                    <div className="aide-item" style={{backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px'}}>
                      <div className="aide-label">
                        <strong>🏢 MaPrimeRénov' Copropriété</strong>
                        <span className="aide-desc">
                          Aide collective ({resultats.detailsCopro?.tauxFinal} du montant HT)
                          {resultats.detailsCopro?.bonusSortiePassoire && ' + Bonus sortie passoire'}
                          {resultats.detailsCopro?.bonusCoproFragile && ' + Bonus copro fragile'}
                        </span>
                      </div>
                      <div className="aide-montant">
                        {resultats.aides.maPrimeRenov.toLocaleString('fr-FR')} €
                      </div>
                    </div>

                    {resultats.aides.primesIndividuelles > 0 && (
                      <div className="aide-item">
                        <div className="aide-label">
                          <strong>👥 Primes individuelles</strong>
                          <span className="aide-desc">
                            Pour copropriétaires modestes/très modestes
                          </span>
                        </div>
                        <div className="aide-montant">
                          {resultats.aides.primesIndividuelles.toLocaleString('fr-FR')} €
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* AFFICHAGE INDIVIDUEL */
                  <>
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
                  </>
                )}

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

                {/* AVERTISSEMENT ÉCRÊTEMENT (NOUVEAU 2026) */}
                {resultats.ecretement && resultats.ecretement.actif && (
                  <div className="aide-item" style={{
                    marginTop: '16px',
                    backgroundColor: '#fff3cd',
                    border: '2px solid #ffc107',
                    padding: '12px',
                    borderRadius: '8px'
                  }}>
                    <div className="aide-label">
                      <strong style={{color: '#856404'}}>⚠️ Écrêtement appliqué (2026)</strong>
                      <span className="aide-desc" style={{color: '#856404'}}>
                        Cumul CEE + MPR plafonné à {Math.round(resultats.ecretement.tauxMax * 100)}% de 12 000€ = {resultats.ecretement.plafondCumul.toLocaleString('fr-FR')} €
                        <br />
                        <small>Montant écrêté : {resultats.ecretement.montantEcrete.toLocaleString('fr-FR')} €</small>
                      </span>
                    </div>
                    <div className="aide-montant" style={{color: '#856404', fontSize: '14px'}}>
                      Plafond atteint
                    </div>
                  </div>
                )}

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
