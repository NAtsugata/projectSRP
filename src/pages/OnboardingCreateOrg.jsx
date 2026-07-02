import React, { useState } from 'react';
import { organizationService } from '../services/organizationService';
import { authService } from '../lib/supabase';
import { AlertTriangleIcon } from '../components/SharedUI';
import './LoginScreen.css';

/**
 * Écran d'onboarding affiché lorsqu'un utilisateur est connecté mais
 * n'appartient à aucune organisation (inscription self-service).
 *
 * - "Créer mon entreprise" → RPC create_organization_with_owner
 * - "J'ai un code d'invitation" → RPC accept_invitation
 *
 * Note : les employés invités par email sont normalement rattachés
 * automatiquement à l'inscription (trigger handle_new_user). Le champ
 * code d'invitation est un secours.
 */
export default function OnboardingCreateOrg({ userEmail, onOrganizationReady, onLogout }) {
    const [mode, setMode] = useState('create'); // 'create' | 'join'
    const [companyName, setCompanyName] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        if (companyName.trim().length < 2) {
            setError("Le nom de l'entreprise est trop court.");
            return;
        }
        setLoading(true);
        try {
            const { error: rpcError } = await organizationService.createOwnOrganization(companyName.trim());
            if (rpcError) {
                setError(traduireErreur(rpcError.message));
            } else {
                await onOrganizationReady();
            }
        } catch (err) {
            console.error('Erreur création organisation:', err);
            setError("Une erreur est survenue. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setError('');
        if (!inviteToken.trim()) {
            setError("Saisissez votre code d'invitation.");
            return;
        }
        setLoading(true);
        try {
            const { error: rpcError } = await organizationService.acceptInvitation(inviteToken.trim());
            if (rpcError) {
                setError(traduireErreur(rpcError.message));
            } else {
                await onOrganizationReady();
            }
        } catch (err) {
            console.error('Erreur acceptation invitation:', err);
            setError("Une erreur est survenue. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await authService.signOut();
        if (onLogout) onLogout();
    };

    return (
        <div className="login-screen-container">
            <div className="login-background">
                <div className="gradient-orb gradient-orb-1"></div>
                <div className="gradient-orb gradient-orb-2"></div>
                <div className="gradient-orb gradient-orb-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <img src="/logo192.png" alt="SRP Logo" className="logo-image" />
                        <h1 className="logo-text">Portail SRP</h1>
                    </div>
                    <p className="tagline">Bienvenue {userEmail ? `(${userEmail})` : ''} 👋</p>
                </div>

                <div className="auth-tabs">
                    <button
                        type="button"
                        className={`auth-tab ${mode === 'create' ? 'auth-tab-active' : ''}`}
                        onClick={() => { setMode('create'); setError(''); }}
                    >
                        Créer une entreprise
                    </button>
                    <button
                        type="button"
                        className={`auth-tab ${mode === 'join' ? 'auth-tab-active' : ''}`}
                        onClick={() => { setMode('join'); setError(''); }}
                    >
                        J'ai une invitation
                    </button>
                </div>

                {mode === 'create' ? (
                    <form onSubmit={handleCreate} className="login-form">
                        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem', lineHeight: 1.5 }}>
                            Créez l'espace de votre entreprise. Vous en serez l'administrateur
                            et pourrez inviter vos employés. Essai gratuit inclus.
                        </p>
                        <div className="login-input-group">
                            <label>Nom de l'entreprise</label>
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => { setCompanyName(e.target.value); setError(''); }}
                                className={`login-input ${error ? 'input-error' : ''}`}
                                placeholder="Ex : SRP Plomberie"
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="login-error">
                                <AlertTriangleIcon size={20} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !companyName}
                            className={`login-submit-btn ${loading ? 'btn-loading' : ''}`}
                        >
                            {loading ? '' : 'Créer mon entreprise'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJoin} className="login-form">
                        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.25rem', lineHeight: 1.5 }}>
                            Si votre employeur vous a invité par email, vous êtes normalement
                            déjà rattaché. Sinon, saisissez le code d'invitation reçu.
                        </p>
                        <div className="login-input-group">
                            <label>Code d'invitation</label>
                            <input
                                type="text"
                                value={inviteToken}
                                onChange={(e) => { setInviteToken(e.target.value); setError(''); }}
                                className={`login-input ${error ? 'input-error' : ''}`}
                                placeholder="Collez votre code ici"
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="login-error">
                                <AlertTriangleIcon size={20} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !inviteToken}
                            className={`login-submit-btn ${loading ? 'btn-loading' : ''}`}
                        >
                            {loading ? '' : 'Rejoindre mon entreprise'}
                        </button>
                    </form>
                )}

                <div className="login-footer">
                    <button type="button" className="link-button" onClick={handleLogout}>
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}

// Traduit les codes d'erreur des RPC en messages lisibles
function traduireErreur(message = '') {
    if (message.includes('already_in_org')) return 'Vous appartenez déjà à une organisation.';
    if (message.includes('invalid_invitation')) return 'Invitation invalide ou expirée.';
    if (message.includes('email_mismatch')) return "Cette invitation est destinée à une autre adresse email.";
    if (message.includes('org_user_limit')) return "L'entreprise a atteint sa limite d'utilisateurs.";
    if (message.includes('invalid_name')) return "Nom d'entreprise invalide.";
    return message || 'Une erreur est survenue.';
}
