#!/usr/bin/env node
/**
 * Test du système de planification multi-jours
 * Vérifie que tous les composants fonctionnent correctement
 */

import {
  createMultiDayIntervention,
  generateWorkingDays,
  calculateOptimalDuration,
  isPublicHoliday,
  rescheduleIntervention
} from './src/utils/smartScheduler.js';

import {
  autoAssignTechnicians,
  calculateCompatibilityScore,
  suggestBestTeams,
  optimizeWorkload
} from './src/utils/autoAssignment.js';

import {
  detectConflicts,
  validateScheduling,
  generateConflictReport
} from './src/utils/conflictDetection.js';

import {
  generateSchedulingSuggestions,
  suggestImprovements
} from './src/utils/schedulingSuggestions.js';

console.log('\n🧪 TEST DU SYSTÈME DE PLANIFICATION MULTI-JOURS\n');
console.log('='.repeat(60));

let testsPassés = 0;
let testsTotaux = 0;

function test(nom, fn) {
  testsTotaux++;
  try {
    fn();
    console.log(`✅ Test ${testsTotaux}: ${nom}`);
    testsPassés++;
  } catch (error) {
    console.log(`❌ Test ${testsTotaux}: ${nom}`);
    console.error(`   Erreur: ${error.message}`);
  }
}

// ========================================
// 1. Tests smartScheduler
// ========================================
console.log('\n📅 1. TESTS SMART SCHEDULER');
console.log('-'.repeat(60));

test('Génération de dates ouvrées (5 jours)', () => {
  const dates = generateWorkingDays('2026-03-17', 5, {
    includeWeekends: false,
    excludePublicHolidays: true
  });

  if (dates.length !== 5) {
    throw new Error(`Attendu 5 dates, reçu ${dates.length}`);
  }
  console.log(`   Dates: ${dates.join(', ')}`);
});

test('Détection jours fériés (1er mai)', () => {
  const date = new Date('2026-05-01');
  const isFerie = isPublicHoliday(date);

  if (!isFerie) {
    throw new Error('Le 1er mai devrait être détecté comme férié');
  }
});

test('Calcul durée optimale (installation complexe)', () => {
  const intervention = {
    type: 'installation',
    complexity: 'very_high',
    estimated_hours: 32
  };

  const duration = calculateOptimalDuration(intervention);

  if (duration < 1) {
    throw new Error(`Durée invalide: ${duration}`);
  }
  console.log(`   Durée calculée: ${duration} jours`);
});

test('Création intervention multi-jours', () => {
  const intervention = {
    type: 'installation',
    complexity: 'high',
    description: 'Test installation',
    estimated_hours: 28
  };

  const multiDay = createMultiDayIntervention(
    intervention,
    '2026-03-17',
    4
  );

  if (!multiDay.is_multi_day) {
    throw new Error('is_multi_day devrait être true');
  }

  if (!multiDay.scheduled_dates || multiDay.scheduled_dates.length !== 4) {
    throw new Error(`Attendu 4 dates, reçu ${multiDay.scheduled_dates?.length}`);
  }

  if (!multiDay.daily_plan) {
    throw new Error('daily_plan manquant');
  }

  console.log(`   Dates planifiées: ${multiDay.scheduled_dates.join(', ')}`);
  console.log(`   Phases: ${Object.keys(multiDay.daily_plan).length} jours`);
});

test('Replanification intervention', () => {
  const intervention = {
    type: 'maintenance',
    scheduled_dates: ['2026-03-17', '2026-03-18'],
    duration_days: 2,
    metadata: {
      excluded_weekends: true,
      excluded_holidays: true
    }
  };

  const rescheduled = rescheduleIntervention(intervention, '2026-03-24', 3);

  if (rescheduled.duration_days !== 3) {
    throw new Error(`Durée incorrecte: ${rescheduled.duration_days}`);
  }

  console.log(`   Nouvelles dates: ${rescheduled.scheduled_dates.join(', ')}`);
});

// ========================================
// 2. Tests autoAssignment
// ========================================
console.log('\n🤖 2. TESTS AUTO-ASSIGNMENT');
console.log('-'.repeat(60));

const mockUsers = [
  {
    id: '1',
    full_name: 'Jean Dupont',
    skills: ['installation', 'plomberie']
  },
  {
    id: '2',
    full_name: 'Marie Martin',
    skills: ['maintenance', 'diagnostic']
  },
  {
    id: '3',
    full_name: 'Pierre Durand',
    skills: ['installation', 'electricite']
  }
];

test('Calcul score de compatibilité', () => {
  const intervention = {
    type: 'installation',
    date: '2026-03-17',
    scheduled_dates: ['2026-03-17']
  };

  const score = calculateCompatibilityScore(mockUsers[0], intervention, {
    absences: [],
    existingAssignments: {},
    allUsers: mockUsers
  });

  if (score < 0 || score > 100) {
    throw new Error(`Score invalide: ${score}`);
  }

  console.log(`   Score Jean Dupont: ${score}%`);
});

test('Auto-assignation techniciens', () => {
  const intervention = {
    type: 'installation',
    complexity: 'medium',
    scheduled_dates: ['2026-03-17', '2026-03-18', '2026-03-19']
  };

  const assignment = autoAssignTechnicians(
    intervention,
    mockUsers,
    {
      absences: [],
      existingAssignments: {},
      allUsers: mockUsers
    },
    {
      teamSize: 2,
      minScore: 50
    }
  );

  if (!assignment.assignedUsers || assignment.assignedUsers.length === 0) {
    throw new Error('Aucun technicien assigné');
  }

  if (!assignment.dailyAssignments) {
    throw new Error('dailyAssignments manquant');
  }

  console.log(`   Techniciens: ${assignment.assignedUsers.length}`);
  console.log(`   Confiance: ${assignment.confidence}%`);
  console.log(`   Détails: ${assignment.details.map(d => `${d.name} (${d.score}%)`).join(', ')}`);
});

test('Suggestion meilleures équipes', () => {
  const intervention = {
    type: 'installation',
    complexity: 'very_high'
  };

  const teams = suggestBestTeams(intervention, mockUsers, {
    absences: [],
    existingAssignments: {},
    allUsers: mockUsers
  });

  if (teams.length === 0) {
    throw new Error('Aucune équipe suggérée');
  }

  console.log(`   ${teams.length} équipes suggérées`);
  console.log(`   Meilleure équipe (${teams[0].score}%): ${teams[0].members.map(m => m.name).join(', ')}`);
});

// ========================================
// 3. Tests conflictDetection
// ========================================
console.log('\n⚠️  3. TESTS DÉTECTION DE CONFLITS');
console.log('-'.repeat(60));

test('Détection conflits (aucun conflit)', () => {
  const intervention = {
    id: 'test-1',
    type: 'maintenance',
    date: '2026-03-17',
    scheduled_dates: ['2026-03-17'],
    intervention_assignments: [{ user_id: '1' }]
  };

  const conflicts = detectConflicts(intervention, mockUsers, {
    allInterventions: [],
    absences: [],
    maxInterventionsPerDay: 2
  });

  console.log(`   Conflits détectés: ${conflicts.length}`);
});

test('Validation planification', () => {
  const intervention = {
    id: 'test-2',
    type: 'installation',
    scheduled_dates: ['2026-03-17', '2026-03-18'],
    intervention_assignments: [{ user_id: '1' }]
  };

  const validation = validateScheduling(intervention, {
    users: mockUsers,
    allInterventions: [],
    absences: []
  });

  if (typeof validation.valid !== 'boolean') {
    throw new Error('validation.valid manquant');
  }

  if (!Array.isArray(validation.conflicts)) {
    throw new Error('validation.conflicts doit être un tableau');
  }

  console.log(`   Validation: ${validation.valid ? 'OK' : 'KO'}`);
  console.log(`   Conflits: ${validation.conflicts.length}`);
  console.log(`   Peut procéder: ${validation.canProceed}`);
});

test('Génération rapport de conflits', () => {
  const conflicts = [
    {
      type: 'absence',
      severity: 'critical',
      message: 'Jean Dupont est absent'
    },
    {
      type: 'overload',
      severity: 'warning',
      message: 'Surcharge détectée'
    }
  ];

  const report = generateConflictReport(conflicts);

  if (!report || report.length === 0) {
    throw new Error('Rapport vide');
  }

  console.log(`   Rapport généré (${report.length} caractères)`);
});

// ========================================
// 4. Tests schedulingSuggestions
// ========================================
console.log('\n💡 4. TESTS SUGGESTIONS DE PLANIFICATION');
console.log('-'.repeat(60));

test('Génération suggestions', () => {
  const intervention = {
    type: 'installation',
    complexity: 'medium',
    estimated_hours: 20
  };

  const suggestions = generateSchedulingSuggestions(
    intervention,
    {
      users: mockUsers,
      allInterventions: [],
      absences: []
    },
    {
      preferredStartDate: new Date('2026-03-17'),
      maxSuggestions: 3
    }
  );

  if (!Array.isArray(suggestions)) {
    throw new Error('Suggestions doit être un tableau');
  }

  console.log(`   ${suggestions.length} suggestions générées`);

  if (suggestions.length > 0) {
    console.log(`   Meilleure: ${suggestions[0].label} (score: ${suggestions[0].qualityScore})`);
  }
});

// ========================================
// RÉSUMÉ
// ========================================
console.log('\n' + '='.repeat(60));
console.log(`\n📊 RÉSUMÉ: ${testsPassés}/${testsTotaux} tests réussis\n`);

if (testsPassés === testsTotaux) {
  console.log('✅ TOUS LES TESTS SONT PASSÉS !');
  console.log('\n🎉 Le système de planification multi-jours est opérationnel.\n');
  process.exit(0);
} else {
  console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
  console.log(`\n⚠️  ${testsTotaux - testsPassés} test(s) en échec.\n`);
  process.exit(1);
}
