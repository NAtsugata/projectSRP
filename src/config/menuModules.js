// src/config/menuModules.js
// Modules de menu activables/désactivables par le chef d'entreprise.
//
// Le choix est stocké dans organizations.settings.hidden_modules = [clés...].
// Un module masqué disparaît du menu pour l'admin ET ses employés (sidebar,
// navigation mobile, grille mobile). Les modules "cœur" (navigation
// essentielle + pages de réglages) ne sont jamais masquables, pour qu'on
// puisse toujours revenir réactiver un module.

// Pages toujours visibles (jamais masquables)
export const CORE_HREFS = new Set([
  '/dashboard',
  '/planning',
  '/users',
  '/settings',
  '/company-settings',
  '/organizations',
]);

// Modules optionnels, dans l'ordre d'affichage souhaité dans les réglages
export const MENU_MODULES = [
  { key: 'agenda', label: 'Agenda', hint: 'Vue agenda / calendrier', hrefs: ['/agenda'] },
  { key: 'leaves', label: 'Congés', hint: 'Demandes et validation des congés', hrefs: ['/leaves', '/admin-leaves'] },
  { key: 'expenses', label: 'Dépenses', hint: 'Notes de frais', hrefs: ['/expenses', '/admin-expenses'] },
  { key: 'vault', label: 'Coffre-fort', hint: 'Documents partagés', hrefs: ['/vault', '/admin-vault'] },
  { key: 'documents', label: 'Mes Documents', hint: 'Documents personnels', hrefs: ['/documents'] },
  { key: 'archives', label: 'Archives', hint: 'Interventions archivées', hrefs: ['/archives'] },
  { key: 'checklists', label: 'Checklists', hint: 'Listes de contrôle', hrefs: ['/checklists', '/checklist-templates'] },
  { key: 'contracts', label: 'Contrats', hint: 'Contrats de maintenance', hrefs: ['/contracts'] },
  { key: 'clients', label: 'Clients', hint: 'Fichier clients', hrefs: ['/clients'] },
  { key: 'invoices', label: 'Facturation', hint: 'Devis et factures', hrefs: ['/invoices'] },
  { key: 'catalog', label: 'Catalogue', hint: 'Articles et prestations', hrefs: ['/catalog'] },
  { key: 'monthly-export', label: 'Export Comptable', hint: 'Export mensuel', hrefs: ['/monthly-export'] },
  { key: 'ir-docs', label: 'IR Douche', hint: 'Formulaires IR Douche', hrefs: ['/ir-docs'] },
  { key: 'cerfa', label: 'PDF / CERFA', hint: 'Génération des CERFA', hrefs: ['/cerfa'] },
  { key: 'aides', label: "Aides d'État", hint: 'Calculateur des aides', hrefs: ['/calculateur-aides'] },
];

// Table href -> clé de module (pour filtrer la navigation)
export const HREF_TO_MODULE = MENU_MODULES.reduce((acc, m) => {
  m.hrefs.forEach((h) => { acc[h] = m.key; });
  return acc;
}, {});

/**
 * Un href doit-il être masqué compte tenu des modules désactivés ?
 * Les hrefs "cœur" ou inconnus restent toujours visibles.
 */
export function isHrefHidden(href, hiddenKeys = []) {
  if (CORE_HREFS.has(href)) return false;
  const key = HREF_TO_MODULE[href];
  if (!key) return false;
  return hiddenKeys.includes(key);
}
