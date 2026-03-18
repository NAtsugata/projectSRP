// src/components/subsidy/SubsidyCalculator.jsx
// Calculateur de primes CEE et MaPrimeRénov' - Style CEDEO

import React, { useState, useEffect } from 'react';
import { calculateFullSubsidy } from '../../utils/subsidyCalculations';
import SubsidyResult from './SubsidyResult';
import './SubsidyCalculator.css';

const SubsidyCalculator = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Étape 1 : Identité
    applicant_type: 'owner',
    entity_type: 'individual',

    // Étape 2 : Bâtiment
    building_age: 'more_than_15',
    housing_type: 'house', // 'house' ou 'apartment'
    postal_code: '',
    heated_surface: '',

    // Étape 3 : PAC - Type et usage
    application_type: 'low_temp',
    usage: 'heating',
    has_regulator: true,
    regulator_class: 4,

    // Étape 4 : PAC - Performances
    etas: '',
    thermal_power: '',
    starting_intensity: 'mono_45A',

    // Étape 5 : Configuration système
    has_other_heating: false,
    emitter_type: 'radiant',
    has_dhw_system: false,
    dhw_consumes_energy: false,
    dhw_has_backup: false,

    // Étape 6 : Contexte et remplacement
    replacement_type: 'none',
    has_exit_sieve: false,
    has_bbc_target: false,

    // Étape 7 : Financier
    project_cost: '',
    rfr: '',
    household_size: 1,
  });

  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [errors, setErrors] = useState({});

  // Mise à jour du champ
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ modifié
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Validation d'une étape
  const validateStep = (currentStep) => {
    const newErrors = {};

    switch (currentStep) {
      case 2: // Bâtiment
        if (!formData.postal_code || formData.postal_code.length !== 5) {
          newErrors.postal_code = 'Code postal requis (5 chiffres)';
        }
        if (!formData.heated_surface || formData.heated_surface < 10) {
          newErrors.heated_surface = 'Surface requise (minimum 10m²)';
        }
        break;

      case 4: // Performances PAC
        if (!formData.etas || formData.etas < 100) {
          newErrors.etas = 'ETAS requis (minimum 100%)';
        }
        if (!formData.thermal_power || formData.thermal_power < 1) {
          newErrors.thermal_power = 'Puissance requise (minimum 1kW)';
        }
        break;

      case 7: // Financier
        if (!formData.project_cost || formData.project_cost < 1000) {
          newErrors.project_cost = 'Coût du projet requis (minimum 1000€)';
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Passer à l'étape suivante
  const nextStep = () => {
    if (validateStep(step)) {
      if (step === 7) {
        // Dernière étape : calculer
        calculateSubsidy();
      } else {
        setStep(prev => prev + 1);
      }
    }
  };

  // Revenir à l'étape précédente
  const prevStep = () => {
    if (showResult) {
      setShowResult(false);
    } else if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  // Calculer les primes
  const calculateSubsidy = () => {
    const calculationResult = calculateFullSubsidy(formData);
    setResult(calculationResult);
    setShowResult(true);
  };

  // Affiner le résultat avec RFR et foyer
  const refineResult = (rfr, householdSize) => {
    const updatedData = { ...formData, rfr, household_size: householdSize };
    const calculationResult = calculateFullSubsidy(updatedData);
    setResult(calculationResult);
  };

  // Réinitialiser
  const reset = () => {
    setStep(1);
    setFormData({
      applicant_type: 'owner',
      entity_type: 'individual',
      building_age: 'more_than_15',
      postal_code: '',
      heated_surface: '',
      application_type: 'low_temp',
      usage: 'heating',
      has_regulator: true,
      regulator_class: 4,
      etas: '',
      thermal_power: '',
      starting_intensity: 'mono_45A',
      has_other_heating: false,
      emitter_type: 'radiant',
      has_dhw_system: false,
      dhw_consumes_energy: false,
      dhw_has_backup: false,
      replacement_type: 'none',
      has_exit_sieve: false,
      has_bbc_target: false,
      project_cost: '',
      rfr: '',
      household_size: 1,
    });
    setResult(null);
    setShowResult(false);
    setErrors({});
  };

  // Affichage du résultat
  if (showResult && result) {
    return (
      <SubsidyResult
        result={result}
        formData={formData}
        onBack={prevStep}
        onReset={reset}
        onRefine={refineResult}
      />
    );
  }

  return (
    <div className="subsidy-calculator">
      <div className="calculator-header">
        <h2>Calculez et obtenez votre prime</h2>
        <p className="calculator-subtitle">
          Votre projet : <strong>PAC Pompe à chaleur de type air/eau</strong>
        </p>
        <a href="#conditions" className="conditions-link">
          Lire les conditions d'éligibilité
        </a>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(step / 7) * 100}%` }} />
      </div>
      <div className="step-indicator">
        Étape {step} sur 7
      </div>

      {/* Formulaire */}
      <div className="calculator-form">
        {/* Étape 1 : Identité */}
        {step === 1 && (
          <div className="form-step">
            <h3>Vous êtes :</h3>
            <div className="radio-group">
              <label className={formData.applicant_type === 'tenant' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="applicant_type"
                  value="tenant"
                  checked={formData.applicant_type === 'tenant'}
                  onChange={(e) => handleChange('applicant_type', e.target.value)}
                />
                Le locataire
              </label>
              <label className={formData.applicant_type === 'owner' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="applicant_type"
                  value="owner"
                  checked={formData.applicant_type === 'owner'}
                  onChange={(e) => handleChange('applicant_type', e.target.value)}
                />
                Le propriétaire
              </label>
            </div>

            <h3>Votre profil :</h3>
            <div className="radio-group">
              <label className={formData.entity_type === 'individual' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="entity_type"
                  value="individual"
                  checked={formData.entity_type === 'individual'}
                  onChange={(e) => handleChange('entity_type', e.target.value)}
                />
                Une personne physique
              </label>
              <label className={formData.entity_type === 'company' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="entity_type"
                  value="company"
                  checked={formData.entity_type === 'company'}
                  onChange={(e) => handleChange('entity_type', e.target.value)}
                />
                Une personne morale
              </label>
            </div>
          </div>
        )}

        {/* Étape 2 : Bâtiment */}
        {step === 2 && (
          <div className="form-step">
            <h3>Bâtiment résidentiel existant depuis :</h3>
            <div className="radio-group">
              <label className={formData.building_age === 'less_than_2' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="building_age"
                  value="less_than_2"
                  checked={formData.building_age === 'less_than_2'}
                  onChange={(e) => handleChange('building_age', e.target.value)}
                />
                Moins de 2 ans
              </label>
              <label className={formData.building_age === '2_to_15' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="building_age"
                  value="2_to_15"
                  checked={formData.building_age === '2_to_15'}
                  onChange={(e) => handleChange('building_age', e.target.value)}
                />
                Entre 2 et 15 ans
              </label>
              <label className={formData.building_age === 'more_than_15' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="building_age"
                  value="more_than_15"
                  checked={formData.building_age === 'more_than_15'}
                  onChange={(e) => handleChange('building_age', e.target.value)}
                />
                Plus de 15 ans
              </label>
            </div>

            <h3>Type de logement :</h3>
            <div className="radio-group">
              <label className={formData.housing_type === 'house' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="housing_type"
                  value="house"
                  checked={formData.housing_type === 'house'}
                  onChange={(e) => handleChange('housing_type', e.target.value)}
                />
                Maison individuelle
              </label>
              <label className={formData.housing_type === 'apartment' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="housing_type"
                  value="apartment"
                  checked={formData.housing_type === 'apartment'}
                  onChange={(e) => handleChange('housing_type', e.target.value)}
                />
                Appartement
              </label>
            </div>

            <h3>Code postal des travaux :</h3>
            <input
              type="text"
              className={`form-input ${errors.postal_code ? 'error' : ''}`}
              value={formData.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder="75001"
              maxLength="5"
            />
            {errors.postal_code && <span className="error-message">{errors.postal_code}</span>}

            <h3>Quelle est la surface habitable chauffée par la PAC (en m²) :</h3>
            <input
              type="number"
              className={`form-input ${errors.heated_surface ? 'error' : ''}`}
              value={formData.heated_surface}
              onChange={(e) => handleChange('heated_surface', parseFloat(e.target.value))}
              placeholder="100"
              min="10"
            />
            {errors.heated_surface && <span className="error-message">{errors.heated_surface}</span>}
          </div>
        )}

        {/* Étape 3 : Type et usage PAC */}
        {step === 3 && (
          <div className="form-step">
            <h3>Quel est son type d'application ?</h3>
            <div className="radio-group">
              <label className={formData.application_type === 'low_temp' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="application_type"
                  value="low_temp"
                  checked={formData.application_type === 'low_temp'}
                  onChange={(e) => handleChange('application_type', e.target.value)}
                />
                Basse température
              </label>
              <label className={formData.application_type === 'medium_temp' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="application_type"
                  value="medium_temp"
                  checked={formData.application_type === 'medium_temp'}
                  onChange={(e) => handleChange('application_type', e.target.value)}
                />
                Moyenne température
              </label>
              <label className={formData.application_type === 'high_temp' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="application_type"
                  value="high_temp"
                  checked={formData.application_type === 'high_temp'}
                  onChange={(e) => handleChange('application_type', e.target.value)}
                />
                Haute température
              </label>
            </div>

            <h3>Quel est l'usage de la pompe à chaleur ?</h3>
            <div className="radio-group">
              <label className={formData.usage === 'heating' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="usage"
                  value="heating"
                  checked={formData.usage === 'heating'}
                  onChange={(e) => handleChange('usage', e.target.value)}
                />
                Chauffage
              </label>
              <label className={formData.usage === 'heating_and_dhw' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="usage"
                  value="heating_and_dhw"
                  checked={formData.usage === 'heating_and_dhw'}
                  onChange={(e) => handleChange('usage', e.target.value)}
                />
                Chauffage et eau chaude sanitaire
              </label>
              <label className={formData.usage === 'other' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="usage"
                  value="other"
                  checked={formData.usage === 'other'}
                  onChange={(e) => handleChange('usage', e.target.value)}
                />
                Autre
              </label>
            </div>

            <h3>La PAC est-elle équipée d'un régulateur ?</h3>
            <div className="radio-group">
              <label className={formData.has_regulator === true ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_regulator"
                  value="true"
                  checked={formData.has_regulator === true}
                  onChange={() => handleChange('has_regulator', true)}
                />
                Oui
              </label>
              <label className={formData.has_regulator === false ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_regulator"
                  value="false"
                  checked={formData.has_regulator === false}
                  onChange={() => handleChange('has_regulator', false)}
                />
                Non
              </label>
            </div>

            {formData.has_regulator && (
              <>
                <h3>De quelle classe est son régulateur ?</h3>
                <div className="radio-group">
                  {[4, 5, 6, 7, 8].map(cls => (
                    <label key={cls} className={formData.regulator_class === cls ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="regulator_class"
                        value={cls}
                        checked={formData.regulator_class === cls}
                        onChange={() => handleChange('regulator_class', cls)}
                      />
                      {['IV', 'V', 'VI', 'VII', 'VIII'][cls - 4]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Étape 4 : Performances */}
        {step === 4 && (
          <div className="form-step">
            <h3>Quelle est l'efficacité énergétique saisonnière (Etas) (en %) ?</h3>
            <input
              type="number"
              className={`form-input ${errors.etas ? 'error' : ''}`}
              value={formData.etas}
              onChange={(e) => handleChange('etas', parseFloat(e.target.value))}
              placeholder="126"
              min="100"
              max="200"
            />
            {errors.etas && <span className="error-message">{errors.etas}</span>}

            <h3>Quelle est la puissance thermique nominale de la pompe à chaleur (en kW) ?</h3>
            <input
              type="number"
              className={`form-input ${errors.thermal_power ? 'error' : ''}`}
              value={formData.thermal_power}
              onChange={(e) => handleChange('thermal_power', parseFloat(e.target.value))}
              placeholder="8"
              min="1"
              max="100"
              step="0.1"
            />
            {errors.thermal_power && <span className="error-message">{errors.thermal_power}</span>}

            <h3>Quelle est l'intensité au démarrage ?</h3>
            <div className="radio-group">
              <label className={formData.starting_intensity === 'mono_45A' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="starting_intensity"
                  value="mono_45A"
                  checked={formData.starting_intensity === 'mono_45A'}
                  onChange={(e) => handleChange('starting_intensity', e.target.value)}
                />
                Au plus 45A en monophasé
              </label>
              <label className={formData.starting_intensity === 'tri_60A' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="starting_intensity"
                  value="tri_60A"
                  checked={formData.starting_intensity === 'tri_60A'}
                  onChange={(e) => handleChange('starting_intensity', e.target.value)}
                />
                Au plus 60A en triphasé
              </label>
              <label className={formData.starting_intensity === 'other' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="starting_intensity"
                  value="other"
                  checked={formData.starting_intensity === 'other'}
                  onChange={(e) => handleChange('starting_intensity', e.target.value)}
                />
                Autre
              </label>
            </div>
          </div>
        )}

        {/* Étape 5 : Configuration système */}
        {step === 5 && (
          <div className="form-step">
            <h3>La pompe à chaleur est-elle (ou sera-t-elle) associée à un autre système de chauffage ?</h3>
            <div className="radio-group">
              <label className={formData.has_other_heating === true ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_other_heating"
                  value="true"
                  checked={formData.has_other_heating === true}
                  onChange={() => handleChange('has_other_heating', true)}
                />
                Oui
              </label>
              <label className={formData.has_other_heating === false ? 'selected' : ''}>
                <input
                  type="radio"
                  name="has_other_heating"
                  value="false"
                  checked={formData.has_other_heating === false}
                  onChange={() => handleChange('has_other_heating', false)}
                />
                Non
              </label>
            </div>

            <h3>La PAC est-elle associée à des émetteurs de type :</h3>
            <div className="radio-group">
              <label className={formData.emitter_type === 'radiant' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="emitter_type"
                  value="radiant"
                  checked={formData.emitter_type === 'radiant'}
                  onChange={(e) => handleChange('emitter_type', e.target.value)}
                />
                Plancher chauffant, plafond chauffant, mur chauffant ou émetteurs localisés du type ventilo-convecteurs à eau
              </label>
              <label className={formData.emitter_type === 'mixed' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="emitter_type"
                  value="mixed"
                  checked={formData.emitter_type === 'mixed'}
                  onChange={(e) => handleChange('emitter_type', e.target.value)}
                />
                Mixtes (ex. : radiateurs et plancher chauffant, plancher chauffant et ECS...)
              </label>
              <label className={formData.emitter_type === 'other' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="emitter_type"
                  value="other"
                  checked={formData.emitter_type === 'other'}
                  onChange={(e) => handleChange('emitter_type', e.target.value)}
                />
                Autres (dont radiateur)
              </label>
            </div>

            {formData.usage === 'heating_and_dhw' && (
              <>
                <h3>La PAC est associée à un système déporté, permettant la production de l'eau chaude sanitaire par celle-ci ?</h3>
                <div className="radio-group">
                  <label className={formData.has_dhw_system === true ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="has_dhw_system"
                      value="true"
                      checked={formData.has_dhw_system === true}
                      onChange={() => handleChange('has_dhw_system', true)}
                    />
                    Oui
                  </label>
                  <label className={formData.has_dhw_system === false ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="has_dhw_system"
                      value="false"
                      checked={formData.has_dhw_system === false}
                      onChange={() => handleChange('has_dhw_system', false)}
                    />
                    Non
                  </label>
                </div>

                {formData.has_dhw_system && (
                  <>
                    <h3>Ce système déporté consomme-t-il de l'énergie pour la production de l'eau chaude sanitaire ?</h3>
                    <div className="radio-group">
                      <label className={formData.dhw_consumes_energy === true ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="dhw_consumes_energy"
                          value="true"
                          checked={formData.dhw_consumes_energy === true}
                          onChange={() => handleChange('dhw_consumes_energy', true)}
                        />
                        Oui
                      </label>
                      <label className={formData.dhw_consumes_energy === false ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="dhw_consumes_energy"
                          value="false"
                          checked={formData.dhw_consumes_energy === false}
                          onChange={() => handleChange('dhw_consumes_energy', false)}
                        />
                        Non
                      </label>
                    </div>

                    <h3>Les systèmes déportés intègrent-ils une résistance électrique à des fins de secours ou de cycles anti-légionelle, et pour lesquels la régulation priorise la pompe à chaleur pour la production de l'eau chaude sanitaire ?</h3>
                    <div className="radio-group">
                      <label className={formData.dhw_has_backup === true ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="dhw_has_backup"
                          value="true"
                          checked={formData.dhw_has_backup === true}
                          onChange={() => handleChange('dhw_has_backup', true)}
                        />
                        Oui
                      </label>
                      <label className={formData.dhw_has_backup === false ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="dhw_has_backup"
                          value="false"
                          checked={formData.dhw_has_backup === false}
                          onChange={() => handleChange('dhw_has_backup', false)}
                        />
                        Non
                      </label>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Étape 6 : Remplacement et contexte */}
        {step === 6 && (
          <div className="form-step">
            <h3>Les travaux comprennent le remplacement d'une chaudière individuelle ou convecteur fonctionnant :</h3>
            <div className="radio-group">
              <label className={formData.replacement_type === 'coal' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="replacement_type"
                  value="coal"
                  checked={formData.replacement_type === 'coal'}
                  onChange={(e) => handleChange('replacement_type', e.target.value)}
                />
                Au charbon
              </label>
              <label className={formData.replacement_type === 'fuel' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="replacement_type"
                  value="fuel"
                  checked={formData.replacement_type === 'fuel'}
                  onChange={(e) => handleChange('replacement_type', e.target.value)}
                />
                Au fioul
              </label>
              <label className={formData.replacement_type === 'gas' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="replacement_type"
                  value="gas"
                  checked={formData.replacement_type === 'gas'}
                  onChange={(e) => handleChange('replacement_type', e.target.value)}
                />
                Au gaz
              </label>
              <label className={formData.replacement_type === 'electric' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="replacement_type"
                  value="electric"
                  checked={formData.replacement_type === 'electric'}
                  onChange={(e) => handleChange('replacement_type', e.target.value)}
                />
                A l'électricité
              </label>
              <label className={formData.replacement_type === 'none' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="replacement_type"
                  value="none"
                  checked={formData.replacement_type === 'none'}
                  onChange={(e) => handleChange('replacement_type', e.target.value)}
                />
                Autre ou pas de remplacement
              </label>
            </div>

            <h3>Options bonus (optionnel)</h3>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.has_exit_sieve}
                  onChange={(e) => handleChange('has_exit_sieve', e.target.checked)}
                />
                Sortie de passoire énergétique (étiquette F ou G → D minimum)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.has_bbc_target}
                  onChange={(e) => handleChange('has_bbc_target', e.target.checked)}
                />
                Objectif BBC (atteindre étiquette A ou B)
              </label>
            </div>
          </div>
        )}

        {/* Étape 7 : Financier */}
        {step === 7 && (
          <div className="form-step">
            <h3>Coût total du projet (fourniture + pose en €) :</h3>
            <input
              type="number"
              className={`form-input ${errors.project_cost ? 'error' : ''}`}
              value={formData.project_cost}
              onChange={(e) => handleChange('project_cost', parseFloat(e.target.value))}
              placeholder="10000"
              min="1000"
            />
            {errors.project_cost && <span className="error-message">{errors.project_cost}</span>}
            <p className="hint">Le coût doit inclure la fourniture et la pose de la PAC</p>

            <h3>Informations optionnelles (pour calcul précis) :</h3>
            <p className="hint">Vous pourrez compléter ces informations après le calcul initial</p>

            <div className="form-group">
              <label>Nombre de personnes dans le foyer :</label>
              <input
                type="number"
                className="form-input"
                value={formData.household_size}
                onChange={(e) => handleChange('household_size', parseInt(e.target.value))}
                min="1"
                max="10"
              />
            </div>

            <div className="form-group">
              <label>Revenu fiscal de référence total du foyer (€) :</label>
              <input
                type="number"
                className="form-input"
                value={formData.rfr}
                onChange={(e) => handleChange('rfr', parseFloat(e.target.value))}
                placeholder="30000"
                min="0"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="form-navigation">
          {step > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={prevStep}
            >
              ← Retour
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={nextStep}
          >
            {step === 7 ? 'Calculer ma prime' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubsidyCalculator;
