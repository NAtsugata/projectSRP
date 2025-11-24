// src/pages/AdminExpensesViewContainer.js
import React from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import AdminExpensesView from './AdminExpensesView';

const AdminExpensesViewContainer = () => {
    const toast = useToast();
    const { expenses, isLoading, approveExpense, rejectExpense, deleteExpense, markAsPaid } = useExpenses();
    const { users } = useUsers();

    const handleApprove = async (id, comment) => {
        try {
            await approveExpense({ id, comment });
            toast?.success('Note de frais approuvée');
        } catch (error) {
            toast?.error('Erreur lors de l\'approbation');
            throw error;
        }
    };

    const handleReject = async (id, comment) => {
        try {
            await rejectExpense({ id, comment });
            toast?.success('Note de frais rejetée');
        } catch (error) {
            toast?.error('Erreur lors du rejet');
            throw error;
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteExpense(id);
            toast?.success('Note de frais supprimée');
        } catch (error) {
            toast?.error('Erreur lors de la suppression');
            throw error;
        }
    };

    const handleMarkAsPaid = async (id) => {
        try {
            await markAsPaid(id);
            toast?.success('Marquée comme payée');
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour');
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des notes de frais...</div>
            </div>
        );
    }

    return (
        <AdminExpensesView
            expenses={expenses}
            users={users}
            onApproveExpense={handleApprove}
            onRejectExpense={handleReject}
            onDeleteExpense={handleDelete}
            onMarkAsPaid={handleMarkAsPaid}
        />
    );
};

export default AdminExpensesViewContainer;
