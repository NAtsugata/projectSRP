// src/components/ModuleGate.jsx
// Protège une page par module vendu séparément : affiche l'écran
// « module non inclus » si l'organisation n'y a pas droit.

import { useNavigate } from 'react-router-dom';
import { useModules } from '../hooks/useModules';
import { usePermissions } from '../hooks/usePermissions';

export function ModuleLockedPage({ moduleKey }) {
  const navigate = useNavigate();
  const { getModule } = useModules();
  const { isAdmin } = usePermissions();
  const mod = getModule(moduleKey);
  const label = mod?.label || moduleKey;

  return (
    <div className="module-locked" data-module={moduleKey}>
      <div className="module-locked-card">
        <div className="module-locked-icon" aria-hidden="true">🔒</div>
        <h2>{label}</h2>
        <p className="module-locked-lead">Ce module n'est pas inclus dans votre abonnement.</p>
        {mod?.description && <p className="module-locked-desc">{mod.description}</p>}
        {mod?.ends_at && new Date(mod.ends_at) < new Date() && (
          <p className="module-locked-desc">Votre période d'essai s'est terminée le {new Date(mod.ends_at).toLocaleDateString('fr-FR')}.</p>
        )}
        <p className="module-locked-help">
          {isAdmin
            ? 'Vos données existantes sont conservées. Contactez votre fournisseur pour activer ce module.'
            : "Demandez à l'administrateur de votre entreprise d'activer ce module."}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}

export default function ModuleGate({ module: moduleKey, children }) {
  const { hasModule, isLoading } = useModules();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }
  if (!hasModule(moduleKey)) return <ModuleLockedPage moduleKey={moduleKey} />;
  return children;
}

/** Enveloppe un composant de page dans un ModuleGate (utilisé dans App.jsx) */
export const withModule = (moduleKey, Component) => {
  const Gated = (props) => (
    <ModuleGate module={moduleKey}>
      <Component {...props} />
    </ModuleGate>
  );
  Gated.displayName = `withModule(${moduleKey})`;
  return Gated;
};
