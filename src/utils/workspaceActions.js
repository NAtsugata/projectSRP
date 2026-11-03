// navigation and allowedKinds come from the current account's access checks.
export function workspaceActions(navigation, isAdmin, allowedKinds = []) {
  const visible = new Set(navigation.map(item => item.href));
  return [
    { page: '/planning', href: isAdmin ? '/planning?new=true' : '/planning', title: isAdmin ? 'Planifier une intervention' : 'Mon planning', description: isAdmin ? 'Organiser le prochain rendez-vous' : 'Retrouver mes rendez-vous et consignes', icon: 'calendar', tone: 'sage' },
    { page: '/documents', href: '/documents?scan=photo', title: 'Scanner un document', description: 'Photographier, recadrer et créer un PDF', icon: 'camera', tone: 'copper' },
    { page: '/my-requests', href: '/my-requests?type=expense', title: 'Ajouter une note de frais', description: 'Préparer et suivre mon remboursement', icon: 'file', tone: 'blue', kind: 'expense' },
    { page: '/my-requests', href: '/my-requests?type=leave', title: 'Demander un congé', description: 'Choisir mes dates et envoyer ma demande', icon: 'calendar', tone: 'sage', kind: 'leave' },
    { page: '/followups', href: '/followups', title: 'Revoir les dossiers', description: 'Retrouver les décisions et prochaines actions', icon: 'check', tone: 'copper', admin: true },
    { page: '/chantiers', href: '/chantiers', title: 'Ouvrir les chantiers', description: 'Retrouver les dossiers et leur avancement', icon: 'briefcase', tone: 'blue' },
  ].filter(action => visible.has(action.page) && (!action.admin || isAdmin) && (!action.kind || allowedKinds.includes(action.kind)));
}
