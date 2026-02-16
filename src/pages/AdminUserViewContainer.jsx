// src/pages/AdminUserViewContainer.js
import React from 'react';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import AdminUserView from './AdminUserView';

const AdminUserViewContainer = () => {
    const toast = useToast();
    const { users, isLoading, error, refetch, updateUser } = useUsers();

    const handleUpdateUser = async (id, updates) => {
        try {
            await updateUser({ id, updates });
            toast?.success('Utilisateur mis à jour');
        } catch (err) {
            toast?.error('Erreur lors de la mise à jour');
            throw err;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des utilisateurs...</div>
            </div>
        );
    }

    // Afficher l'erreur si présente
    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#ef4444' }}>❌ Erreur de chargement</h2>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    {error?.message || JSON.stringify(error)}
                </p>
                <button
                    onClick={() => refetch()}
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🔄 Réessayer
                </button>
            </div>
        );
    }

    // Afficher avertissement si aucun utilisateur
    if (!users || users.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#f59e0b' }}>⚠️ Aucun utilisateur trouvé</h2>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    La liste des utilisateurs est vide. Cela peut être dû à un problème de permissions RLS.
                </p>
                <button
                    onClick={() => refetch()}
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    🔄 Rafraîchir
                </button>
            </div>
        );
    }

    return (
        <AdminUserView
            users={users}
            onUpdateUser={handleUpdateUser}
        />
    );
};

export default AdminUserViewContainer;
