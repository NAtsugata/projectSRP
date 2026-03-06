// src/hooks/usePermissions.js
// Hook pour gerer les permissions de l'utilisateur

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { permissionService } from '../services/permissionService';

export function usePermissions() {
  const { profile } = useAuthStore();
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les permissions au montage ou quand le profil change
  useEffect(() => {
    const loadPermissions = async () => {
      if (!profile?.id) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      // Les admins ont toutes les permissions
      if (profile.is_admin || profile.is_super_admin) {
        setPermissions(['*']); // Wildcard = toutes les permissions
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error: fetchError } = await permissionService.getUserPermissions(profile.id);

        if (fetchError) {
          console.error('Erreur chargement permissions:', fetchError);
          setError(fetchError);
          setPermissions([]);
        } else if (data) {
          const codes = data.map(p => p.permission_code).filter(Boolean);
          setPermissions(codes);
        }
      } catch (err) {
        console.error('Erreur permissions:', err);
        setError(err);
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [profile?.id, profile?.is_admin, profile?.is_super_admin]);

  // Verifier si l'utilisateur a une permission specifique
  const hasPermission = useCallback((permissionCode) => {
    // Admin a toutes les permissions
    if (profile?.is_admin || profile?.is_super_admin) {
      return true;
    }
    // Wildcard = toutes les permissions
    if (permissions.includes('*')) {
      return true;
    }
    return permissions.includes(permissionCode);
  }, [permissions, profile?.is_admin, profile?.is_super_admin]);

  // Verifier si l'utilisateur a au moins une des permissions
  const hasAnyPermission = useCallback((permissionCodes) => {
    if (profile?.is_admin || profile?.is_super_admin) {
      return true;
    }
    if (permissions.includes('*')) {
      return true;
    }
    return permissionCodes.some(code => permissions.includes(code));
  }, [permissions, profile?.is_admin, profile?.is_super_admin]);

  // Verifier si l'utilisateur a toutes les permissions
  const hasAllPermissions = useCallback((permissionCodes) => {
    if (profile?.is_admin || profile?.is_super_admin) {
      return true;
    }
    if (permissions.includes('*')) {
      return true;
    }
    return permissionCodes.every(code => permissions.includes(code));
  }, [permissions, profile?.is_admin, profile?.is_super_admin]);

  // Recharger les permissions
  const refreshPermissions = useCallback(async () => {
    if (!profile?.id || profile?.is_admin || profile?.is_super_admin) {
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await permissionService.getUserPermissions(profile.id);

      if (!fetchError && data) {
        const codes = data.map(p => p.permission_code).filter(Boolean);
        setPermissions(codes);
      }
    } catch (err) {
      console.error('Erreur refresh permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, profile?.is_admin, profile?.is_super_admin]);

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
    isAdmin: profile?.is_admin || profile?.is_super_admin || false
  };
}

export default usePermissions;
