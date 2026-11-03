import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { normalizeSearch } from '../../utils/workspaceTracking';
import { WorkspaceQuickActions } from './WorkspaceExperience';

const GROUPS = [
  ['Activité', ['/dashboard', '/followups', '/planning', '/chantiers', '/agenda', '/multi-day-planning']],
  ['Gestion', ['/clients', '/contracts', '/invoices', '/odoo-quotes', '/catalog', '/expenses', '/admin-expenses']],
  ['Équipe', ['/my-requests', '/users', '/leaves', '/admin-leaves']],
  ['Documents', ['/vault', '/admin-vault', '/documents', '/archives', '/checklists', '/checklist-templates', '/monthly-export', '/ir-docs', '/cerfa', '/calculateur-aides']],
];
const LABELS = {
  '/dashboard': 'Tableau de bord', '/leaves': 'Congés', '/expenses': 'Dépenses',
  '/documents': 'Mes documents', '/monthly-export': 'Export comptable',
  '/settings': 'Paramètres', '/company-settings': 'Entreprise',
  '/admin-expenses': 'Valider les dépenses', '/admin-leaves': 'Valider les congés',
};
export function navigationGroups(navigation) {
  const used = new Set();
  const groups = GROUPS.map(([label, hrefs]) => {
    const items = hrefs.flatMap(href => navigation.filter(item => item.href === href));
    items.forEach(item => used.add(item.href));
    return { label, items };
  });
  groups.push({ label: 'Administration', items: navigation.filter(item => !used.has(item.href)) });
  return groups.filter(group => group.items.length);
}
export function NavigationGroups({ navigation, onNavigate }) {
  return navigationGroups(navigation).map(group => (
    <section className="workspace-nav-group" key={group.label}>
      <h2>{group.label}</h2>
      {group.items.map(item => (
        <NavLink key={item.href} to={item.href} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={onNavigate} target={item.isExternal ? '_blank' : undefined}
          rel={item.isExternal ? 'noopener noreferrer' : undefined}>
          <item.icon /><span>{LABELS[item.href] || item.name}</span>
        </NavLink>
      ))}
    </section>
  ));
}
export function WorkspaceHeader({ navigation, profile, isAdmin, allowedKinds }) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const current = navigation.find(item => pathname === item.href || pathname.startsWith(item.href + '/'));
  const results = useMemo(() => navigation.filter(item => normalizeSearch(LABELS[item.href] || item.name).includes(normalizeSearch(query))), [navigation, query]);
  useEffect(() => { setQuery(''); }, [pathname]);
  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); input.current?.focus(); }
      if (event.key === 'Escape') { setQuery(''); input.current?.blur(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <header className="workspace-topbar">
      <nav aria-label="Fil d’Ariane" className="workspace-breadcrumb">
        <span>Mon espace</span><span aria-hidden="true">/</span>
        <strong>{LABELS[current?.href] || current?.name || 'Détail'}</strong>
      </nav>
      <div className="workspace-nav-search">
        <label htmlFor="workspace-page-search" className="workspace-sr-only">Rechercher une page du portail</label>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg>
        <input id="workspace-page-search" ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Accéder à une page…" autoComplete="off" aria-controls={query.trim() ? 'workspace-search-results' : undefined} />
        <kbd aria-hidden="true">Ctrl K</kbd>
        {query.trim() && (
          <div className="workspace-search-results" id="workspace-search-results">
            <p>Pages accessibles</p>
            {results.length ? results.map(item => <Link key={item.href} to={item.href} onClick={() => setQuery('')}><item.icon />{LABELS[item.href] || item.name}<span aria-hidden="true">↗</span></Link>) : <p>Aucune page trouvée.</p>}
          </div>
        )}
      </div>
      <WorkspaceQuickActions navigation={navigation} isAdmin={isAdmin} allowedKinds={allowedKinds} />
      <div className="workspace-profile" title={profile?.full_name}>
        <span className="workspace-avatar" aria-hidden="true">{(profile?.full_name || 'SRP').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
        <span>{profile?.full_name || 'Mon espace'}<small>Portail SRP</small></span>
      </div>
    </header>
  );
}
export function WorkspaceMenu({ open, onClose, navigation }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (open) {
      if (!node.open) node.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; if (node.open) node.close(); };
    }
    if (node.open) node.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="workspace-menu" aria-labelledby="workspace-menu-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="workspace-menu-content">
        <div className="workspace-menu-heading"><div><span>PORTAIL SRP</span><h2 id="workspace-menu-title">Votre espace de travail</h2></div><button type="button" onClick={onClose} aria-label="Fermer le menu">×</button></div>
        <nav aria-label="Toutes les pages"><NavigationGroups navigation={navigation} onNavigate={onClose} /></nav>
      </div>
    </dialog>
  );
}
