// src/pages/AdminLeaveView.js - Version refactorisée
// Gestion des demandes de congés avec composants modulaires

import React, { useCallback } from 'react';
import { LeaveRequestList } from '../components/leave';
import logger from '../utils/logger';
import './AdminLeaveView.css';

export default function AdminLeaveView({
  leaveRequests = [],
  onUpdateStatus,
  onDelete
}) {
  // Adapter callbacks for component API
  const handleApprove = useCallback((requestId) => {
    logger.log('AdminLeaveView: Approbation demande', requestId);
    onUpdateStatus(requestId, 'Approuvée');
  }, [onUpdateStatus]);

  const handleReject = useCallback((requestId) => {
    logger.log('AdminLeaveView: Rejet demande', requestId);
    onUpdateStatus(requestId, 'Rejetée');
  }, [onUpdateStatus]);

  const handleDelete = useCallback((requestId) => {
    logger.log('AdminLeaveView: Suppression demande', requestId);
    onDelete(requestId);
  }, [onDelete]);

  return (
    <div className="admin-leave-view">
      <div className="leave-header">
        <h2 className="leave-title">Gestion des Demandes de Congés</h2>
        <p className="leave-description">
          Approuvez ou rejetez les demandes de congés de vos employés.
        </p>
      </div>

      <div className="leave-list-section">
        <LeaveRequestList
          requests={leaveRequests}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
          showFilters={true}
          showSort={true}
          showActions={true}
          showUserName={true}
        />
      </div>
    </div>
  );
}
