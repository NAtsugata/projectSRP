// src/hooks/useModules.js
// Droits d'accès aux modules vendus séparément, pour l'organisation courante.
// hasModule(key) : true pour les clés inconnues / cœur, pour le super-admin,
// et pour les modules inclus dans la formule ou activés à la carte.

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { moduleService } from '../services/moduleService';

export const MODULES_QUERY_KEY = 'org-modules';

export function useModules() {
  const { profile } = useAuthStore();
  const isSuperAdmin = !!profile?.is_super_admin;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [MODULES_QUERY_KEY, profile?.organization_id],
    queryFn: async () => (await moduleService.getEffectiveModules()).data,
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000,
  });

  const modules = useMemo(() => data || [], [data]);
  const enabledKeys = useMemo(() => new Set(modules.filter(m => m.enabled).map(m => m.module_key)), [modules]);
  const knownKeys = useMemo(() => new Set(modules.map(m => m.module_key)), [modules]);

  const hasModule = useCallback((key) => {
    if (!key || isSuperAdmin) return true;
    if (!knownKeys.has(key)) return true; // clé inconnue ou module cœur : jamais bloqué
    return enabledKeys.has(key);
  }, [isSuperAdmin, knownKeys, enabledKeys]);

  const getModule = useCallback((key) => modules.find(m => m.module_key === key) || null, [modules]);

  return {
    modules,
    hasModule,
    getModule,
    isLoading: !!profile?.organization_id && isLoading,
    refetch,
    isSuperAdmin,
  };
}

export default useModules;
