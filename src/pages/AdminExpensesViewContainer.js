// src/pages/AdminExpensesViewContainer.js
import React, { useState } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import AdminExpensesView from './AdminExpensesView';

const AdminExpensesViewContainer = ({ showConfirmationModal }) => {
    const toast = useToast();
    // Default filter: last 3 months to avoid loading too much data
    const [filters, setFilters] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return { startDate: d.toISOString() };
    });

    const { expenses, isLoading, approveExpense, rejectExpense, deleteExpense, markAsPaid } = useExpenses(null, filters);
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

    const handleDelete = async (expense) => {
        // Si showConfirmationModal est fourni, on l'utilise
        if (showConfirmationModal) {
            showConfirmationModal({
                title: 'Supprimer la note de frais ?',
                message: `Êtes-vous sûr de vouloir supprimer cette note de frais de ${expense.amount}€ ? Cette action est irréversible.`,
                onConfirm: async () => {
                    try {
                        await deleteExpense(expense.id);
                        toast?.success('Note de frais supprimée');
                    } catch (error) {
                        toast?.error('Erreur lors de la suppression');
                    }
                }
            });
        } else {
            // Fallback si pas de modal (ne devrait pas arriver si bien câblé)
            if (window.confirm('Supprimer cette note de frais ?')) {
                try {
                    await deleteExpense(expense.id);
                    toast?.success('Note de frais supprimée');
                } catch (error) {
                    toast?.error('Erreur lors de la suppression');
                }
            }
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
            filters={filters}
            onUpdateFilters={setFilters}
        />
    );
};

export default AdminExpensesViewContainer;
