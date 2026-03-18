// src/components/subsidy/SubsidyCoproCalculator.jsx
// Calculateur MaPrimeRénov' Copropriété

import React, { useState } from 'react';
import { calculateFullCoproSubsidy } from '../../utils/subsidyCoproCalculations';
import { COPRO_DISTRIBUTION_EXAMPLES } from '../../utils/subsidyCoproData';
import SubsidyCoproResult from './SubsidyCoproResult';
import './SubsidyCalculator.css';

const SubsidyCoproCalculator = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Étape 1 : Copropriété
    building_age: 15,
    postal_code: '',
    housing_count: '',
    principal_residence_rate: 0.75,

    // Étape 2 : Travaux
    total_cost: '',
    energy_gain: 35,
    work_categories: [],

    // Étape 3 : Bonus et accompagnement
    has_exit_sieve: false,
    has_bbc_target: false,
    is_fragile: false,
    has_accompaniment: true,
    accompaniment_cost: 0,

    // Étape 4 : Répartition copropriétaires (optionnel)
    use_custom_distribution: false,
    distribution_preset: 'mixed',
    distribution: null,
  });

  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateStep = (currentStep) => {
    const newErrors = {};

    switch (currentStep) {
      case 1: // Copropriété
        if (!formData.postal_code || formData.postal_code.length !== 5) {
          newErrors.postal_code = 'Code postal requis (5 chiffres)';
        }
        if (!formData.housing_count || formData.housing_count < 2) {
          newErrors.housing_count = 'Nombre de logements requis (minimum 2)';
        }
        if (formData.building_age < 15) {
          newErrors.building_age = 'Bâtiment doit avoir minimum 15 ans';
        }
        break;

      case 2: // Travaux
        if (!formData.total_cost || formData.total_cost < 10000) {
          newErrors.total_cost = 'Coût total requis (minimum 10 000€)';
        }
        if (formData.energy_gain < 35) {
          newErrors.energy_gain = 'Gain énergétique minimum 35%';
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step === 4) {
        calculateSubsidy();
      } else {
        setStep(prev => prev + 1);
      }
    }
  };

  const prevStep = () => {
    if (showResult) {
      setShowResult(false);
    } else if (step > 1) {
      setStep(prev => prev - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const calculateSubsidy = () => {
    // Préparer la distribution
    let distribution = null;
    if (formData.use_custom_distribution) {
      distribution = formData.distribution;
    } else {
      const preset = COPRO_DISTRIBUTION_EXAMPLES.find(d => d.id === formData.distribution_preset);
      distribution = preset?.distribution || null;
    }

    const calculationData = {
      ...formData,
      distribution,
    };

    const calculationResult = calculateFullCoproSubsidy(calculationData);
    setResult(calculationResult);
    setShowResult(true);
  };

  const reset = () => {
    setStep(1);
    setFormData({
      building_age: 15,
      postal_code: '',
      housing_count: '',
      principal_residence_rate: 0.75,
      total_cost: '',
      energy_gain: 35,
      work_categories: [],
      has_exit_sieve: false,
      has_bbc_target: false,
      is_fragile: false,
      has_accompaniment: true,
      accompaniment_cost: 0,
      use_custom_distribution: false,
      distribution_preset: 'mixed',
      distribution: null,
    });
    setResult(null);
    setShowResult(false);
    setErrors({});
  };

  if (showResult && result) {
    return (
      <SubsidyCoproResult
        result={result}
        formData={formData}
        onBack={prevStep}
        onReset={reset}
      />
    );
  }

  return (
    <div className="subsidy-calculator">
      <div className="calculator-header">
        <h2>Calculez les aides MaPrimeRénov' Copropriété</h2>
        <p className="calculator-subtitle">
          Pour travaux de rénovation énergétique sur <strong>parties communes</strong>
        </p>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
      <div className="step-indicator">
        Étape {step} sur 4
      </div>

      <div className="calculator-form">
        {/* Étape 1 : Copropriété */}
        {step === 1 && (
          <div className="form-step">
            <h3>Âge du bâtiment (années) :</h3>
            <input
              type="number"
              className={`form-input ${errors.building_age ? 'error' : ''}`}
              value={formData.building_age}
              onChange={(e) => handleChange('building_age', parseInt(e.target.value))}
              placeholder="15"
              min="15"
            />
            {errors.building_age && <span className="error-message">{errors.building_age}</span>}
            <p className="hint">Minimum 15 ans requis pour MaPrimeRénov' Copropriété</p>

            <h3>Code postal de la copropriété :</h3>
            <input
              type="text"
              className={`form-input ${errors.postal_code ? 'error' : ''}`}
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder="75001"
              maxLength="5"
            />
            {errors.postal_code && <span className="error-message">{errors.postal_code}</span>}

            <h3>Nombre de logements dans la copropriété :</h3>
            <input
              type="number"
              className={`form-input ${errors.housing_count ? 'error' : ''}`}
              value={formData.housing_count}
              onChange={(e) => handleChange('housing_count', parseInt(e.target.value))}
              placeholder="20"
              min="2"
            />
            {errors.housing_count && <span className="error-message">{errors.housing_count}</span>}

            <h3>Taux de résidences principales (%) :</h3>
            <input
              type="number"
              className="form-input"
              value={formData.principal_residence_rate * 100}
              onChange={(e) => handleChange('principal_residence_rate', parseFloat(e.target.value) / 100)}
              placeholder="75"
              min="75"
              max="100"
              step="1"
            />
            <p className="hint">Minimum 75% requis</p>
          </div>
        )}

        {/* Étape 2 : Travaux */}
        {step === 2 && (
          <div className="form-step">
            <h3>Coût total des travaux HT (€) :</h3>
            <input
              type="number"
              className={`form-input ${errors.total_cost ? 'error' : ''}`}
              value={formData.total_cost}
              onChange={(e) => handleChange('total_cost', parseFloat(e.target.value))}
              placeholder="500000"
              min="10000"
            />
            {errors.total_cost && <span className="error-message">{errors.total_cost}</span>}

            <h3>Gain énergétique attendu (%) :</h3>
            <input
              type="number"
              className={`form-input ${errors.energy_gain ? 'error' : ''}`}
              value={formData.energy_gain}
              onChange={(e) => handleChange('energy_gain', parseInt(e.target.value))}
              placeholder="35"
              min="35"
              max="100"
            />
            {errors.energy_gain && <span className="error-message">{errors.energy_gain}</span>}
            <p className="hint">Minimum 35% requis</p>

            <h3>Types de travaux (optionnel) :</h3>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.work_categories.includes('insulation')}
                  onChange={(e) => {
                    const current = formData.work_categories;
                    if (e.target.checked) {
                      handleChange('work_categories', [...current, 'insulation']);
                    } else {
                      handleChange('work_categories', current.filter(c => c !== 'insulation'));
                    }
                  }}
                />
                Isolation (toiture, murs, planchers)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.work_categories.includes('heating')}
                  onChange={(e) => {
                    const current = formData.work_categories;
                    if (e.target.checked) {
                      handleChange('work_categories', [...current, 'heating']);
                    } else {
                      handleChange('work_categories', current.filter(c => c !== 'heating'));
                    }
                  }}
                />
                Chauffage collectif
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.work_categories.includes('ventilation')}
                  onChange={(e) => {
                    const current = formData.work_categories;
                    if (e.target.checked) {
                      handleChange('work_categories', [...current, 'ventilation']);
                    } else {
                      handleChange('work_categories', current.filter(c => c !== 'ventilation'));
                    }
                  }}
                />
                Ventilation
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.work_categories.includes('dhw')}
                  onChange={(e) => {
                    const current = formData.work_categories;
                    if (e.target.checked) {
                      handleChange('work_categories', [...current, 'dhw']);
                    } else {
                      handleChange('work_categories', current.filter(c => c !== 'dhw'));
                    }
                  }}
                />
                Eau chaude sanitaire collective
              </label>
            </div>
          </div>
        )}

        {/* Étape 3 : Bonus */}
        {step === 3 && (
          <div className="form-step">
            <h3>Bonus collectifs :</h3>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.has_exit_sieve}
                  onChange={(e) => handleChange('has_exit_sieve', e.target.checked)}
                />
                Sortie de passoire énergétique (F/G → E minimum) - <strong>+10%</strong>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.has_bbc_target}
                  onChange={(e) => handleChange('has_bbc_target', e.target.checked)}
                />
                Atteinte BBC (étiquette A ou B) - <strong>+10%</strong>
              </label>
              {formData.has_exit_sieve && formData.has_bbc_target && (
                <p className="hint">
                  ✨ Cumul sortie passoire + BBC = <strong>+20%</strong> (au lieu de +10%+10%)
                </p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_fragile}
                  onChange={(e) => handleChange('is_fragile', e.target.checked)}
                />
                Copropriété fragile (en difficulté financière) - <strong>+20%</strong>
              </label>
            </div>

            <h3>Accompagnement Mon Accompagnateur Rénov' :</h3>
            <div className="radio-group">
              <label className={formData.has_accompaniment === true ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_accompaniment"
                  value="true"
                  checked={formData.has_accompaniment === true}
                  onChange={() => handleChange('has_accompaniment', true)}
                />
                Oui (obligatoire, pris en charge à 100%)
              </label>
              <label className={formData.has_accompaniment === false ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_accompaniment"
                  value="false"
                  checked={formData.has_accompaniment === false}
                  onChange={() => handleChange('has_accompaniment', false)}
                />
                Non
              </label>
            </div>
            <p className="hint">
              L'accompagnement est obligatoire et pris en charge à 100% (600€/logement si ≤50 logements, 420€/logement si &gt;50)
            </p>
          </div>
        )}

        {/* Étape 4 : Répartition copropriétaires */}
        {step === 4 && (
          <div className="form-step">
            <h3>Répartition des copropriétaires par catégorie de revenus :</h3>
            <p className="hint">
              Cette information permet de calculer les aides individuelles supplémentaires
              (3000€ pour Bleu, 1500€ pour Jaune, 0€ pour Violet/Rose)
            </p>

            <h3>Profil type de la copropriété :</h3>
            <div className="radio-group">
              {COPRO_DISTRIBUTION_EXAMPLES.map(preset => (
                <label
                  key={preset.id}
                  className={formData.distribution_preset === preset.id ? 'selected' : ''}
                >
                  <input
                    type="radio"
                    name="distribution_preset"
                    value={preset.id}
                    checked={formData.distribution_preset === preset.id}
                    onChange={(e) => handleChange('distribution_preset', e.target.value)}
                  />
                  {preset.label}
                  <span className="hint" style={{ marginLeft: '10px', fontSize: '12px' }}>
                    (Bleu: {preset.distribution.blue * 100}%, Jaune: {preset.distribution.yellow * 100}%,
                    Violet: {preset.distribution.violet * 100}%, Rose: {preset.distribution.rose * 100}%)
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="form-navigation">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={prevStep}
          >
            ← {step === 1 && onBack ? 'Retour au choix' : 'Retour'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={nextStep}
          >
            {step === 4 ? 'Calculer les aides' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubsidyCoproCalculator;
