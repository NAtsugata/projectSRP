// src/utils/employeeAvailability.js
// Helpers de disponibilité des employés côté UI.

/** Statut permanent : un employé 'licencié' n'est jamais affectable. */
export function isEmployable(user) {
  return (user?.employee_status || 'actif') !== 'licencié';
}

/** Retire les employés licenciés d'une liste. */
export function filterEmployable(users = []) {
  return users.filter(isEmployable);
}
