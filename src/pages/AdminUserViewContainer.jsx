// src/pages/AdminUserViewContainer.js
import React from 'react';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import AdminUserView from './AdminUserView';

const AdminUserViewContainer = () => {
    const toast = useToast();
    const { users, isLoading, updateUser } = useUsers();

    const handleUpdateUser = async (id, updates) => {
        try {
            await updateUser({ id, updates });
            toast?.success('Utilisateur mis à jour');
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour');
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des utilisateurs...</div>
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
