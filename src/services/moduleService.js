// src/services/moduleService.js
// Modules vendables séparément : droits effectifs de l'organisation courante
// et gestion par le super-administrateur (formules, options, essais).

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export const moduleService = {
  /** Modules (hors cœur) avec leur statut pour l'organisation courante */
  async getEffectiveModules() {
    const { data, error } = await supabase.rpc('org_effective_modules');
    if (error) {
      logger.error('[modules] org_effective_modules:', error);
      return { data: [], error };
    }
    return { data: data || [], error: null };
  },

  /** Super-admin : modules d'une organisation (statut effectif, source, essai) */
  async adminListOrganizationModules(organizationId) {
    const { data, error } = await supabase.rpc('admin_organization_modules', { p_org: organizationId });
    if (error) logger.error('[modules] admin_organization_modules:', error);
    return { data: data || [], error };
  },

  /** Super-admin : activer / désactiver un module (option, essai, dérogation) */
  async adminSetOrganizationModule(organizationId, moduleKey, { enabled, source = 'manual', endsAt = null, note = null }) {
    const { error } = await supabase.rpc('admin_set_organization_module', {
      p_org: organizationId, p_key: moduleKey, p_enabled: enabled,
      p_source: source, p_ends_at: endsAt, p_note: note,
    });
    if (error) logger.error('[modules] admin_set_organization_module:', error);
    return { error };
  },

  /** Super-admin : retirer le réglage explicite (retour à la formule) */
  async adminResetOrganizationModule(organizationId, moduleKey) {
    const { error } = await supabase.rpc('admin_reset_organization_module', { p_org: organizationId, p_key: moduleKey });
    if (error) logger.error('[modules] admin_reset_organization_module:', error);
    return { error };
  },
};

export default moduleService;
