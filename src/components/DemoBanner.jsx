import { AlertTriangleIcon } from './SharedUI';
import { useAuthStore } from '../store/authStore';
import './DemoBanner.css';

/**
 * Bannière de démonstration affichée en mode démo
 * S'affiche uniquement si organization.settings.demo_mode = true
 */
export function DemoBanner() {
  const { organization } = useAuthStore();

  // N'afficher que si le mode démo est activé
  if (!organization?.settings?.demo_mode) {
    return null;
  }

  const bannerText = organization.settings.demo_banner_text || 'ENVIRONNEMENT DE DÉMONSTRATION';

  return (
    <div className="demo-banner" role="banner" aria-label="Bannière de démonstration">
      <div className="demo-banner-content">
        <AlertTriangleIcon size={20} className="demo-banner-icon" aria-hidden="true" />
        <span className="demo-banner-title">
          {bannerText}
        </span>
        <span className="demo-banner-subtext">
          Les données sont fictives et peuvent être réinitialisées
        </span>
      </div>
    </div>
  );
}
