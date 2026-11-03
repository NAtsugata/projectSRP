import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarIcon, CameraIcon, FileTextIcon, PlusIcon, ChevronRightIcon as ArrowRightIcon, CheckCircleIcon, BriefcaseIcon } from '../SharedUI';
import { normalizeSearch } from '../../utils/workspaceTracking';
import './WorkspaceExperience.css';

import { workspaceActions } from '../../utils/workspaceActions';
const ACTION_ICONS = { calendar: CalendarIcon, camera: CameraIcon, file: FileTextIcon, check: CheckCircleIcon, briefcase: BriefcaseIcon };
function ActionIcon({ name }) { const Icon = ACTION_ICONS[name]; return <Icon />; }

export function WorkspaceLaunchpad({ navigation, profile, isAdmin, allowedKinds }) {
  const { pathname, search } = useLocation();
  const [expanded, setExpanded] = useState(true);
  const actions = workspaceActions(navigation, isAdmin, allowedKinds);
  // Keep deep links and active forms free of additional panels.
  if (!['/dashboard', '/planning'].includes(pathname) || (pathname === '/planning' && !isAdmin) || search || !actions.length) return null;
  return <section className={`workspace-launchpad ${expanded ? '' : 'is-collapsed'}`} aria-labelledby="workspace-welcome-title">
    <div className="workspace-welcome">
      <div className="workspace-welcome-copy"><span className="workspace-eyebrow">{isAdmin ? 'VOTRE ACTIVITÉ, BIEN ORGANISÉE' : 'VOTRE QUOTIDIEN, SIMPLEMENT'}</span>
        <h2 id="workspace-welcome-title">Bonjour{profile?.full_name ? `, ${profile.full_name.trim().split(/\s+/)[0]}` : ''}<span>.</span></h2>
        <p>{isAdmin ? 'Les bonnes actions, au bon endroit. À vous de jouer.' : 'Vos interventions, vos documents et vos demandes à portée de main.'}</p>
      </div>
      <div className="workspace-welcome-aside"><time dateTime={new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })}>{new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })}</time>
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="workspace-daily-actions">{expanded ? 'Réduire les raccourcis' : 'Afficher les raccourcis'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
      </div>
    </div>
    {expanded && <nav id="workspace-daily-actions" className="workspace-action-grid" aria-label="Actions du quotidien">{actions.slice(0, 4).map(action => <Link key={action.href} to={action.href} className={`workspace-action-card tone-${action.tone}`}><span className="workspace-action-icon"><ActionIcon name={action.icon} /></span><strong>{action.title}</strong><small>{action.description}</small><span className="workspace-action-arrow" aria-hidden="true"><ArrowRightIcon /></span></Link>)}</nav>}
  </section>;
}

export function WorkspaceQuickActions({ navigation, isAdmin, allowedKinds }) {
  const dialog = useRef(null), trigger = useRef(null);
  const [query, setQuery] = useState('');
  const { pathname, search } = useLocation();
  const actions = workspaceActions(navigation, isAdmin, allowedKinds).filter(action => normalizeSearch(`${action.title} ${action.description}`).includes(normalizeSearch(query)));
  const close = () => { dialog.current?.close(); setQuery(''); trigger.current?.focus(); };
  useEffect(() => { dialog.current?.close(); setQuery(''); }, [pathname, search]);
  return <>
    <button ref={trigger} className="workspace-quick-trigger" type="button" onClick={() => dialog.current?.showModal()} aria-label="Actions rapides" aria-haspopup="dialog"><PlusIcon /><span>Actions rapides</span></button>
    <dialog ref={dialog} className="workspace-actions-dialog" aria-labelledby="workspace-actions-title" onCancel={() => setQuery('')} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <header><div><span className="workspace-eyebrow">UN RACCOURCI POUR CHAQUE BESOIN</span><h2 id="workspace-actions-title">Que souhaitez-vous faire ?</h2><p>Choisissez une action pour ouvrir son formulaire.</p></div><button type="button" onClick={close} aria-label="Fermer les actions rapides">×</button></header>
      <label className="workspace-action-search"><span className="workspace-sr-only">Rechercher une action</span><input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Scanner, congé, intervention…" /></label>
      <nav className="workspace-dialog-actions" aria-label="Actions disponibles">{actions.map(action => <Link key={action.href} to={action.href} className={`tone-${action.tone}`} onClick={close}><span className="workspace-action-icon"><ActionIcon name={action.icon} /></span><span><strong>{action.title}</strong><small>{action.description}</small></span><ArrowRightIcon /></Link>)}</nav>
      {!actions.length && <p className="workspace-action-empty" role="status">Aucune action correspondante. Essayez « planning » ou « document ».</p>}
      <footer>Vous vérifiez toujours les informations avant de les envoyer.</footer>
    </dialog>
  </>;
}
