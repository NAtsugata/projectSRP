// src/pages/AdminUserViewContainer.js
import React from 'react';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import { organizationService } from '../services/organizationService';
import AdminUserView from './AdminUserView';

// Traduit les codes d'erreur des RPC en messages lisibles
const traduireErreur = (message = '') => {
    if (message.includes('org_user_limit')) return "Limite d'utilisateurs atteinte. Passez à un abonnement supérieur.";
    if (message.includes('email_taken')) return 'Cet email appartient déjà à une organisation.';
    if (message.includes('invalid_email')) return 'Adresse email invalide.';
    if (message.includes('not_admin')) return 'Réservé aux administrateurs.';
    if (message.includes('self_deactivation')) return 'Vous ne pouvez pas désactiver votre propre compte.';
    if (message.includes('wrong_org')) return "Cet employé n'appartient pas à votre organisation.";
    return message || 'Une erreur est survenue.';
};

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

    // Inviter un employé : renvoie le token d'invitation (à partager)
    const handleInvite = async (email, role) => {
        const { data, error: inviteError } = await organizationService.inviteEmployee(email, role);
        if (inviteError) {
            toast?.error(traduireErreur(inviteError.message));
            return null;
        }
        toast?.success('Invitation créée');
        return data; // { invitation_id, invitation_token, invitation_expires_at }
    };

    const handleDeactivate = async (userId) => {
        const { error: deErr } = await organizationService.deactivateEmployee(userId);
        if (deErr) {
            toast?.error(traduireErreur(deErr.message));
            return;
        }
        toast?.success('Employé désactivé (données conservées)');
        refetch();
    };

    const handleReactivate = async (userId) => {
        const { error: reErr } = await organizationService.reactivateEmployee(userId);
        if (reErr) {
            toast?.error(traduireErreur(reErr.message));
            return;
        }
        toast?.success('Employé réactivé');
        refetch();
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
            onInvite={handleInvite}
            onDeactivate={handleDeactivate}
            onReactivate={handleReactivate}
        />
    );
};

export default AdminUserViewContainer;
