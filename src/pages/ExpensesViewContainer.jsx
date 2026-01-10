// src/pages/ExpensesViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à ExpensesView
import React, { useState } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import ExpensesView from './ExpensesView';

/**
 * Container pour ExpensesView qui gère la logique de données avec React Query
 */
const ExpensesViewContainer = () => {
    const { profile } = useAuthStore();
    const toast = useToast();

    // Default filter: last 3 months
    const [filters, setFilters] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return { startDate: d.toISOString().split('T')[0] };
    });

    // Récupérer les notes de frais avec le hook
    const {
        expenses,
        isLoading,
        error,
        createExpense,
        deleteExpense,
        // isCreating, isDeleting unused - available for future loading state UI
    } = useExpenses(profile?.id, filters);

    // Handler pour soumettre une note de frais
    const handleSubmitExpense = async (expenseData) => {
        try {
            await createExpense(expenseData);
            toast?.success('Note de frais créée avec succès');
        } catch (error) {
            console.error('Erreur création note de frais:', error);
            toast?.error('Erreur lors de la création de la note de frais');
            throw error;
        }
    };

    // Handler pour supprimer une note de frais
    const handleDeleteExpense = async (expenseId) => {
        try {
            await deleteExpense(expenseId);
            toast?.success('Note de frais supprimée');
        } catch (error) {
            console.error('Erreur suppression note de frais:', error);
            toast?.error('Erreur lors de la suppression');
            throw error;
        }
    };

    // Afficher le loading si les données sont en cours de chargement
    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des notes de frais...</div>
            </div>
        );
    }

    // Afficher l'erreur si présente
    if (error) {
        return (
            <div style={{ padding: '2rem', color: '#ef4444' }}>
                <h3>Erreur de chargement</h3>
                <p>{error.message || 'Impossible de charger les notes de frais'}</p>
            </div>
        );
    }

    return (
        <ExpensesView
            expenses={expenses}
            onSubmitExpense={handleSubmitExpense}
            onDeleteExpense={handleDeleteExpense}
            profile={profile}
            filters={filters}
            onUpdateFilters={setFilters}
        />
    );
};

export default ExpensesViewContainer;
