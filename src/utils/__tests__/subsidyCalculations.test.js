// src/utils/__tests__/subsidyCalculations.test.js
// Tests unitaires pour le calculateur de primes

import {
  validateTechnicalEligibility,
  calculateCEE,
  calculateMPR,
  applyCeiling,
  calculateFullSubsidy,
} from '../subsidyCalculations';

describe('Subsidy Calculations', () => {
  describe('validateTechnicalEligibility', () => {
    test('should validate eligible PAC', () => {
      const pacSpecs = {
        application_type: 'low_temp',
        etas: 135,
        regulator_class: 5,
        has_regulator: true,
        building_age: 'more_than_15',
      };

      const result = validateTechnicalEligibility(pacSpecs);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toContain('✅ Critères techniques respectés');
    });

    test('should reject PAC without regulator', () => {
      const pacSpecs = {
        application_type: 'low_temp',
        etas: 135,
        regulator_class: 5,
        has_regulator: false,
        building_age: 'more_than_15',
      };

      const result = validateTechnicalEligibility(pacSpecs);

      expect(result.eligible).toBe(false);
      expect(result.reasons.some(r => r.includes('régulateur'))).toBe(true);
    });

    test('should reject PAC with insufficient ETAS', () => {
      const pacSpecs = {
        application_type: 'low_temp',
        etas: 110, // Trop bas (minimum 126 pour basse température)
        regulator_class: 5,
        has_regulator: true,
        building_age: 'more_than_15',
      };

      const result = validateTechnicalEligibility(pacSpecs);

      expect(result.eligible).toBe(false);
      expect(result.reasons.some(r => r.includes('ETAS'))).toBe(true);
    });

    test('should reject building less than 2 years old', () => {
      const pacSpecs = {
        application_type: 'low_temp',
        etas: 135,
        regulator_class: 5,
        has_regulator: true,
        building_age: 'less_than_2',
      };

      const result = validateTechnicalEligibility(pacSpecs);

      expect(result.eligible).toBe(false);
      expect(result.reasons.some(r => r.includes('plus de 2 ans'))).toBe(true);
    });
  });

  describe('calculateCEE', () => {
    test('should calculate CEE for H1 heating only', () => {
      const params = {
        postal_code: '59000', // Lille, zone H1
        usage: 'heating',
        surface: 100,
      };

      const result = calculateCEE(params);

      expect(result.zone).toBe('H1');
      expect(result.very_modest).toBe(5300);
      expect(result.modest).toBe(5300);
      expect(result.classic).toBe(3300);
    });

    test('should calculate CEE for H2 heating + DHW', () => {
      const params = {
        postal_code: '33000', // Bordeaux, zone H2
        usage: 'heating_and_dhw',
        surface: 120,
      };

      const result = calculateCEE(params);

      expect(result.zone).toBe('H2');
      expect(result.very_modest).toBe(4800);
      expect(result.modest).toBe(4800);
    });

    test('should calculate CEE for H3 heating only', () => {
      const params = {
        postal_code: '06000', // Nice, zone H3
        usage: 'heating',
        surface: 80,
      };

      const result = calculateCEE(params);

      expect(result.zone).toBe('H3');
      expect(result.very_modest).toBe(3200);
    });
  });

  describe('calculateMPR', () => {
    test('should calculate base MPR amounts', () => {
      const params = {
        rfr: 25000,
        household_size: 2,
        postal_code: '75012',
        has_exit_sieve: false,
        has_bbc_target: false,
        replacement_type: 'none',
      };

      const result = calculateMPR(params);

      expect(result.category).toBe('blue');
      expect(result.base.blue).toBe(5000);
      expect(result.base.yellow).toBe(4000);
      expect(result.base.violet).toBe(3000);
      expect(result.base.rose).toBe(0);
    });

    test('should add exit sieve bonus', () => {
      const params = {
        rfr: 25000,
        household_size: 2,
        postal_code: '75012',
        has_exit_sieve: true,
        has_bbc_target: false,
        replacement_type: 'none',
      };

      const result = calculateMPR(params);

      expect(result.bonuses.exit_sieve).toBeDefined();
      expect(result.bonuses.exit_sieve.blue).toBe(500);
      expect(result.totals.blue).toBe(5500); // 5000 + 500
    });

    test('should add replacement bonus', () => {
      const params = {
        rfr: 25000,
        household_size: 2,
        postal_code: '75012',
        has_exit_sieve: false,
        has_bbc_target: false,
        replacement_type: 'fuel', // Bonus 1200€
      };

      const result = calculateMPR(params);

      expect(result.bonuses.replacement).toBeDefined();
      expect(result.bonuses.replacement.blue).toBe(1200);
      expect(result.totals.blue).toBe(6200); // 5000 + 1200
    });

    test('should cumulate all bonuses', () => {
      const params = {
        rfr: 25000,
        household_size: 2,
        postal_code: '75012',
        has_exit_sieve: true,
        has_bbc_target: true,
        replacement_type: 'fuel',
      };

      const result = calculateMPR(params);

      // 5000 (base) + 500 (exit) + 500 (bbc) + 1200 (fuel) = 7200
      expect(result.totals.blue).toBe(7200);
    });
  });

  describe('applyCeiling', () => {
    test('should not apply ceiling if under limit', () => {
      const totalSubsidy = 5000;
      const projectCost = 10000;
      const category = 'blue'; // 90% max

      const result = applyCeiling(totalSubsidy, projectCost, category);

      expect(result.capped).toBe(5000);
      expect(result.reduction).toBe(0);
      expect(result.ceiling_rate).toBe(90);
    });

    test('should apply ceiling if over limit', () => {
      const totalSubsidy = 10000;
      const projectCost = 10000;
      const category = 'blue'; // 90% max = 9000€

      const result = applyCeiling(totalSubsidy, projectCost, category);

      expect(result.capped).toBe(9000);
      expect(result.reduction).toBe(1000);
      expect(result.ceiling_rate).toBe(90);
    });

    test('should respect max eligible expense', () => {
      const totalSubsidy = 15000;
      const projectCost = 20000;
      const category = 'blue'; // 90% max, mais plafonné à 12000€

      const result = applyCeiling(totalSubsidy, projectCost, category);

      // 90% de 12000€ = 10800€ (max eligible expense)
      expect(result.capped).toBe(10800);
      expect(result.reduction).toBe(4200);
    });

    test('should apply different ceiling rates', () => {
      const totalSubsidy = 8000;
      const projectCost = 10000;

      const resultBlue = applyCeiling(totalSubsidy, projectCost, 'blue');
      expect(resultBlue.capped).toBe(8000); // 90% = 9000, sous limite

      const resultYellow = applyCeiling(totalSubsidy, projectCost, 'yellow');
      expect(resultYellow.capped).toBe(7500); // 75% = 7500, au-dessus

      const resultViolet = applyCeiling(totalSubsidy, projectCost, 'violet');
      expect(resultViolet.capped).toBe(6000); // 60% = 6000

      const resultRose = applyCeiling(totalSubsidy, projectCost, 'rose');
      expect(resultRose.capped).toBe(4000); // 40% = 4000
    });
  });

  describe('calculateFullSubsidy', () => {
    test('should calculate full subsidy for eligible project', () => {
      const formData = {
        applicant_type: 'owner',
        entity_type: 'individual',
        building_age: 'more_than_15',
        postal_code: '75012',
        heated_surface: 100,
        application_type: 'low_temp',
        usage: 'heating_and_dhw',
        has_regulator: true,
        regulator_class: 5,
        etas: 135,
        thermal_power: 8,
        starting_intensity: 'mono_45A',
        has_other_heating: false,
        emitter_type: 'radiant',
        has_dhw_system: false,
        dhw_consumes_energy: false,
        dhw_has_backup: false,
        replacement_type: 'none',
        has_exit_sieve: false,
        has_bbc_target: false,
        project_cost: 10000,
        rfr: 25000,
        household_size: 2,
      };

      const result = calculateFullSubsidy(formData);

      expect(result.eligible).toBe(true);
      expect(result.scenarios).toHaveLength(4);
      expect(result.climate_zone).toBe('H1');
      expect(result.recommended_scenario).toBeDefined();
      expect(result.recommended_scenario.mpr_category).toBe('blue');
    });

    test('should return ineligible for building < 2 years', () => {
      const formData = {
        building_age: 'less_than_2',
        postal_code: '75012',
        heated_surface: 100,
        application_type: 'low_temp',
        usage: 'heating',
        has_regulator: true,
        regulator_class: 5,
        etas: 135,
        project_cost: 10000,
      };

      const result = calculateFullSubsidy(formData);

      expect(result.eligible).toBe(false);
      expect(result.scenarios).toHaveLength(0);
    });

    test('should calculate scenarios with different amounts', () => {
      const formData = {
        applicant_type: 'owner',
        entity_type: 'individual',
        building_age: 'more_than_15',
        postal_code: '33000', // Bordeaux, H2
        heated_surface: 100,
        application_type: 'medium_temp',
        usage: 'heating',
        has_regulator: true,
        regulator_class: 4,
        etas: 115,
        thermal_power: 8,
        starting_intensity: 'mono_45A',
        has_other_heating: false,
        emitter_type: 'radiant',
        has_dhw_system: false,
        replacement_type: 'none',
        has_exit_sieve: false,
        has_bbc_target: false,
        project_cost: 8000,
      };

      const result = calculateFullSubsidy(formData);

      expect(result.eligible).toBe(true);

      // Vérifier les montants différents par scénario
      const veryModest = result.scenarios.find(s => s.id === 'very_modest');
      const modest = result.scenarios.find(s => s.id === 'modest');

      expect(veryModest.cee).toBeGreaterThanOrEqual(modest.cee);
      expect(veryModest.mpr).toBeGreaterThan(modest.mpr);
    });
  });
});
