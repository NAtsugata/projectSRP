// src/pages/AdminLeaveViewContainer.js
import React from 'react';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { useToast } from '../contexts/ToastContext';
import AdminLeaveView from './AdminLeaveView';

const AdminLeaveViewContainer = () => {
    const toast = useToast();
    const { leaveRequests, isLoading, updateLeaveRequest, deleteLeaveRequest } = useLeaveRequests();

    const handleUpdateStatus = async (id, status) => {
        try {
            await updateLeaveRequest({ id, updates: { status } });
            toast?.success(`Demande ${status === 'approved' ? 'approuvée' : 'rejetée'}`);
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour');
            throw error;
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteLeaveRequest(id);
            toast?.success('Demande supprimée');
        } catch (error) {
            toast?.error('Erreur lors de la suppression');
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des demandes de congés...</div>
            </div>
        );
    }

    return (
        <AdminLeaveView
            leaveRequests={leaveRequests}
            onUpdateStatus={handleUpdateStatus}
            onDelete={handleDelete}
        />
    );
};

export default AdminLeaveViewContainer;
