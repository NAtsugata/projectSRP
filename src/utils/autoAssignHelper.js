// src/utils/autoAssignHelper.js
// Algorithmes pour l'auto-assignation et l'optimisation

import { checkEmployeeOverload, doIntervensionsOverlap } from './agendaHelpers';
import { isEmployeeAbsent } from '../components/agenda/AbsenceManager';

/**
 * Calculate simple distance between two addresses (approximation)
 * @param {string} address1 - First address
 * @param {string} address2 - Second address
 * @returns {number} - Estimated distance score (lower is better)
 */
const calculateAddressDistance = (address1, address2) => {
  if (!address1 || !address2) return 100;

  // Simple heuristic: check if same city/postal code
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, '');
  const addr1 = normalize(address1);
  const addr2 = normalize(address2);

  // Check postal code similarity (first 5 digits)
  const postal1 = addr1.match(/\d{5}/)?.[0];
  const postal2 = addr2.match(/\d{5}/)?.[0];

  if (postal1 && postal2) {
    if (postal1 === postal2) return 0; // Same postal code
    if (postal1.substring(0, 2) === postal2.substring(0, 2)) return 50; // Same department
  }

  // Check city name similarity
  const words1 = addr1.split(/[\s,]+/);
  const words2 = addr2.split(/[\s,]+/);
  const commonWords = words1.filter(w => w.length > 3 && words2.includes(w));

  if (commonWords.length > 0) return 20;

  return 100; // Different areas
};

/**
 * Suggest best employee for an intervention
 * @param {Object} intervention - Intervention to assign
 * @param {Array} employees - Available employees
 * @param {Array} allInterventions - All interventions for conflict checking
 * @param {Object} options - Options
 * @returns {Array} - Sorted list of employee suggestions with scores
 */
export const suggestEmployeeAssignment = (
  intervention,
  employees,
  allInterventions = [],
  options = {}
) => {
  const {
    maxHours = 8,
    considerDistance = true,
    considerWorkload = true,
    considerAvailability = true
  } = options;

  const suggestions = employees.map(employee => {
    let score = 100; // Start with perfect score
    const reasons = [];
    const warnings = [];

    // 1. Check if employee is absent
    if (considerAvailability && isEmployeeAbsent(employee.id, intervention.date)) {
      return {
        employee,
        score: 0,
        suitable: false,
        reasons: ['Employé absent ce jour-là'],
        warnings: []
      };
    }

    // 2. Check for schedule conflicts
    if (considerAvailability) {
      const employeeInterventions = allInterventions.filter(itv =>
        itv.assigned_to && itv.assigned_to.includes(employee.id)
      );

      const hasConflict = employeeInterventions.some(existingItv =>
        doIntervensionsOverlap({ ...intervention, assigned_to: [employee.id] }, existingItv)
      );

      if (hasConflict) {
        return {
          employee,
          score: 0,
          suitable: false,
          reasons: ['Conflit d\'horaire'],
          warnings: []
        };
      }
    }

    // 3. Check workload
    if (considerWorkload) {
      const workloadCheck = checkEmployeeOverload(
        employee.id,
        intervention.date,
        [...allInterventions, { ...intervention, assigned_to: [employee.id] }],
        maxHours
      );

      if (workloadCheck.overloaded) {
        score -= 30;
        warnings.push(`Charge élevée (${workloadCheck.hours.toFixed(1)}h/${maxHours}h)`);
      } else {
        // Bonus for lower workload (better distribution)
        const loadPercent = (workloadCheck.hours / maxHours) * 100;
        if (loadPercent < 50) {
          score += 10;
          reasons.push('Charge faible');
        }
      }
    }

    // 4. Check geographic proximity
    if (considerDistance && intervention.address) {
      // Find employee's last intervention of the day (before this one)
      const employeeDayInterventions = allInterventions
        .filter(itv =>
          itv.date === intervention.date &&
          itv.assigned_to && itv.assigned_to.includes(employee.id)
        )
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      if (employeeDayInterventions.length > 0) {
        const lastIntervention = employeeDayInterventions[employeeDayInterventions.length - 1];
        const distance = calculateAddressDistance(lastIntervention.address, intervention.address);

        if (distance === 0) {
          score += 20;
          reasons.push('Même secteur que dernière intervention');
        } else if (distance <= 20) {
          score += 10;
          reasons.push('Proximité géographique');
        } else if (distance > 50) {
          score -= 15;
          warnings.push('Secteur éloigné');
        }
      }
    }

    // 5. Check employee skills/specialization (if available)
    if (employee.skills && intervention.type) {
      const hasMatchingSkill = employee.skills.includes(intervention.type);
      if (hasMatchingSkill) {
        score += 15;
        reasons.push('Compétence spécialisée');
      }
    }

    return {
      employee,
      score: Math.max(0, Math.min(100, score)),
      suitable: score > 0,
      reasons,
      warnings
    };
  });

  // Sort by score (highest first)
  return suggestions
    .filter(s => s.suitable)
    .sort((a, b) => b.score - a.score);
};

/**
 * Auto-balance workload across employees for a given period
 * @param {Array} interventions - Interventions to balance
 * @param {Array} employees - Available employees
 * @param {Object} dateRange - Date range
 * @returns {Object} - Suggested reassignments
 */
export const autoBalanceWorkload = (interventions, employees, dateRange) => {
  const suggestions = [];

  // Calculate current workload per employee
  const workloadByEmployee = {};
  employees.forEach(emp => {
    workloadByEmployee[emp.id] = {
      employee: emp,
      hours: 0,
      interventions: []
    };
  });

  interventions.forEach(itv => {
    if (itv.assigned_to) {
      itv.assigned_to.forEach(empId => {
        if (workloadByEmployee[empId]) {
          workloadByEmployee[empId].hours += itv.estimated_duration || 2;
          workloadByEmployee[empId].interventions.push(itv);
        }
      });
    }
  });

  // Find overloaded and underloaded employees
  const avgHours = Object.values(workloadByEmployee).reduce((sum, w) => sum + w.hours, 0) / employees.length;
  const overloaded = Object.values(workloadByEmployee).filter(w => w.hours > avgHours * 1.3);
  const underloaded = Object.values(workloadByEmployee).filter(w => w.hours < avgHours * 0.7);

  // Suggest moving interventions from overloaded to underloaded
  overloaded.forEach(overEmp => {
    const movableInterventions = overEmp.interventions.slice(-2); // Last 2 interventions

    movableInterventions.forEach(itv => {
      const bestTarget = underloaded
        .map(underEmp => ({
          employee: underEmp.employee,
          score: 100 - Math.abs(underEmp.hours + (itv.estimated_duration || 2) - avgHours)
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (bestTarget) {
        suggestions.push({
          intervention: itv,
          from: overEmp.employee,
          to: bestTarget.employee,
          reason: `Rééquilibrage: ${overEmp.employee.full_name} (${overEmp.hours.toFixed(1)}h) → ${bestTarget.employee.full_name}`
        });
      }
    });
  });

  return {
    suggestions,
    currentWorkload: workloadByEmployee,
    avgHours
  };
};

/**
 * Find optimal time slot for an intervention
 * @param {Object} intervention - Intervention to schedule
 * @param {string} employeeId - Employee ID
 * @param {string} date - Target date
 * @param {Array} existingInterventions - Existing interventions
 * @returns {string|null} - Suggested time (HH:MM) or null
 */
export const suggestOptimalTimeSlot = (intervention, employeeId, date, existingInterventions) => {
  const employeeDayInterventions = existingInterventions
    .filter(itv =>
      itv.date === date &&
      itv.assigned_to && itv.assigned_to.includes(employeeId)
    )
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  // If no interventions, suggest 08:00
  if (employeeDayInterventions.length === 0) {
    return '08:00';
  }

  // Find gaps between interventions
  const duration = intervention.estimated_duration || 2;
  const durationMinutes = duration * 60;

  for (let i = 0; i < employeeDayInterventions.length - 1; i++) {
    const current = employeeDayInterventions[i];
    const next = employeeDayInterventions[i + 1];

    const currentEndMinutes = (parseInt(current.time?.split(':')[0] || 0) * 60) +
                               parseInt(current.time?.split(':')[1] || 0) +
                               ((current.estimated_duration || 2) * 60);

    const nextStartMinutes = (parseInt(next.time?.split(':')[0] || 0) * 60) +
                              parseInt(next.time?.split(':')[1] || 0);

    const gapMinutes = nextStartMinutes - currentEndMinutes;

    if (gapMinutes >= durationMinutes + 30) { // +30 min buffer
      const suggestedMinutes = currentEndMinutes + 15; // 15 min break
      const hours = Math.floor(suggestedMinutes / 60);
      const mins = suggestedMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  }

  // If no gap found, suggest after last intervention
  const last = employeeDayInterventions[employeeDayInterventions.length - 1];
  const lastEndMinutes = (parseInt(last.time?.split(':')[0] || 0) * 60) +
                          parseInt(last.time?.split(':')[1] || 0) +
                          ((last.estimated_duration || 2) * 60);

  const suggestedMinutes = lastEndMinutes + 15;
  const hours = Math.floor(suggestedMinutes / 60);
  const mins = suggestedMinutes % 60;

  // Don't suggest after 18:00
  if (hours >= 18) return null;

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};
