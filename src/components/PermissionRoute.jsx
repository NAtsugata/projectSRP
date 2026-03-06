// src/components/PermissionRoute.jsx
// Composant pour proteger les routes par permission

import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

export function PermissionRoute({ permission, permissions, children, fallback = '/planning' }) {
  const { hasPermission, hasAnyPermission, isLoading } = usePermissions();

  // Pendant le chargement, afficher un loader
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Verification des permissions...</p>
      </div>
    );
  }

  // Verifier les permissions
  let hasAccess = false;

  if (permission) {
    // Une seule permission requise
    hasAccess = hasPermission(permission);
  } else if (permissions && Array.isArray(permissions)) {
    // Au moins une des permissions requises
    hasAccess = hasAnyPermission(permissions);
  } else {
    // Pas de permission specifiee = acces autorise
    hasAccess = true;
  }

  if (!hasAccess) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}

export default PermissionRoute;
