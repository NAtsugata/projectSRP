// src/utils/leaveStatus.js
// Statuts canoniques des demandes de congés.
// La base impose : 'pending' | 'approved' | 'rejected' | 'cancelled'
// (contrainte check_leave_requests_status). On stocke TOUJOURS ces valeurs
// et on affiche des libellés français via leaveStatusLabel().

export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const LEAVE_STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
  cancelled: 'Annulée',
};

export const LEAVE_STATUS_COLORS = {
  pending: 'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
  cancelled: 'status-default',
};

/**
 * Normalise un statut (y compris anciennes valeurs françaises) vers la valeur
 * canonique attendue par la base. Tolérant aux accents et variantes.
 */
export function normalizeLeaveStatus(status) {
  if (!status) return LEAVE_STATUS.PENDING;
  const s = String(status).toLowerCase().trim();
  if (s.startsWith('approuv') || s.startsWith('approved')) return LEAVE_STATUS.APPROVED;
  if (s.startsWith('rejet') || s.startsWith('refus') || s.startsWith('reject')) return LEAVE_STATUS.REJECTED;
  if (s.startsWith('annul') || s.startsWith('cancel')) return LEAVE_STATUS.CANCELLED;
  if (s.includes('attente') || s.startsWith('pending')) return LEAVE_STATUS.PENDING;
  return s;
}

/** Libellé français affichable pour un statut (canonique ou legacy). */
export function leaveStatusLabel(status) {
  return LEAVE_STATUS_LABELS[normalizeLeaveStatus(status)] || status;
}

/** Classe CSS de badge pour un statut. */
export function leaveStatusColor(status) {
  return LEAVE_STATUS_COLORS[normalizeLeaveStatus(status)] || 'status-default';
}
