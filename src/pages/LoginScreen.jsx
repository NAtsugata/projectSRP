import React, { useState } from 'react';
import { authService } from '../lib/supabase';
import { MailIcon, LockIcon, AlertTriangleIcon } from '../components/SharedUI';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import './LoginScreen.css';

export default function LoginScreen() {
    // 'login' | 'signup' | 'check-email'
    const [mode, setMode] = useState('login');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUser, setProfile } = useAuthStore();
    const navigate = useNavigate();

    const resetMessages = () => { setError(''); setInfo(''); };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        resetMessages();

        try {
            const result = await authService.signIn(email, password);

            if (result.error) {
                setError('Email ou mot de passe incorrect. Veuillez réessayer.');
            } else if (result.isOfflineMode) {
                if (result.data?.user) {
                    setUser(result.data.user);
                    setProfile(result.data.user);
                }
                navigate('/dashboard');
            }
            // Mode online : redirection gérée par App.js via onAuthStateChange
        } catch (err) {
            console.error('Erreur de connexion:', err);
            setError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        resetMessages();

        if (password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        setLoading(true);
        try {
            const { data, error: signupError } = await authService.signUp(email, password, fullName);

            if (signupError) {
                const msg = signupError.message || '';
                if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
                    setError('Un compte existe déjà avec cet email. Connectez-vous.');
                } else {
                    setError(msg || 'Erreur lors de la création du compte.');
                }
            } else if (data?.session) {
                // Confirmation email désactivée : session immédiate (géré par App.js)
                setInfo('Compte créé, connexion en cours…');
            } else {
                // Confirmation email requise : afficher l'écran de vérification
                setMode('check-email');
            }
        } catch (err) {
            console.error('Erreur inscription:', err);
            setError('Erreur lors de la création du compte. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        resetMessages();
        setLoading(true);
        try {
            const { error: resendError } = await authService.resendConfirmation(email);
            if (resendError) {
                setError("Impossible de renvoyer l'email. Réessayez dans quelques minutes.");
            } else {
                setInfo('Email de confirmation renvoyé.');
            }
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (target) => {
        resetMessages();
        setPassword('');
        setConfirmPassword('');
        setMode(target);
    };

    // --- Écran "Vérifiez votre email" ---
    if (mode === 'check-email') {
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
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📬</div>
                        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Vérifiez votre boîte mail</h2>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Un email de confirmation a été envoyé à<br />
                            <strong style={{ color: '#374151' }}>{email}</strong>.<br />
                            Cliquez sur le lien pour activer votre compte, puis connectez-vous.
                        </p>
                    </div>

                    {info && <div className="login-error" style={{ background: '#ecfdf5', color: '#065f46' }}><span>{info}</span></div>}
                    {error && (
                        <div className="login-error">
                            <AlertTriangleIcon size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="login-submit-btn"
                        style={{ marginTop: '0.5rem' }}
                    >
                        {loading ? '…' : "Renvoyer l'email"}
                    </button>
                    <div className="login-footer">
                        <button type="button" className="link-button" onClick={() => switchMode('login')}>
                            ← Retour à la connexion
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isSignup = mode === 'signup';

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
                    <p className="tagline">
                        {isSignup ? 'Créez votre compte' : 'Gestion des interventions terrain'}
                    </p>
                </div>

                {/* Onglets connexion / inscription */}
                <div className="auth-tabs">
                    <button
                        type="button"
                        className={`auth-tab ${!isSignup ? 'auth-tab-active' : ''}`}
                        onClick={() => switchMode('login')}
                    >
                        Connexion
                    </button>
                    <button
                        type="button"
                        className={`auth-tab ${isSignup ? 'auth-tab-active' : ''}`}
                        onClick={() => switchMode('signup')}
                    >
                        Créer un compte
                    </button>
                </div>

                <form onSubmit={isSignup ? handleSignup : handleLogin} className="login-form">
                    {isSignup && (
                        <div className="login-input-group">
                            <label>Nom complet</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => { setFullName(e.target.value); resetMessages(); }}
                                className="login-input"
                                placeholder="Jean Dupont"
                                required
                                autoComplete="name"
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="login-input-group">
                        <label>
                            <span className="label-icon"><MailIcon size={16} /></span>
                            Adresse email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); resetMessages(); }}
                            className={`login-input ${error ? 'input-error' : ''}`}
                            placeholder="votre@email.com"
                            required
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    <div className="login-input-group">
                        <label>
                            <span className="label-icon"><LockIcon size={16} /></span>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); resetMessages(); }}
                            className={`login-input ${error ? 'input-error' : ''}`}
                            placeholder="••••••••"
                            required
                            autoComplete={isSignup ? 'new-password' : 'current-password'}
                            disabled={loading}
                        />
                        {isSignup && (
                            <small style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Au moins 8 caractères</small>
                        )}
                    </div>

                    {isSignup && (
                        <div className="login-input-group">
                            <label>
                                <span className="label-icon"><LockIcon size={16} /></span>
                                Confirmer le mot de passe
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); resetMessages(); }}
                                className={`login-input ${error ? 'input-error' : ''}`}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                disabled={loading}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="login-error">
                            <AlertTriangleIcon size={20} />
                            <span>{error}</span>
                        </div>
                    )}
                    {info && (
                        <div className="login-error" style={{ background: '#ecfdf5', color: '#065f46' }}>
                            <span>{info}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email || !password || (isSignup && (!fullName || !confirmPassword))}
                        className={`login-submit-btn ${loading ? 'btn-loading' : ''}`}
                    >
                        {loading ? '' : (isSignup ? 'Créer mon compte' : 'Se connecter')}
                    </button>
                </form>

                <div className="login-footer">
                    {isSignup ? (
                        <p>
                            Déjà un compte ?{' '}
                            <button type="button" className="link-button" onClick={() => switchMode('login')}>
                                Se connecter
                            </button>
                        </p>
                    ) : (
                        <p>
                            Pas encore de compte ?{' '}
                            <button type="button" className="link-button" onClick={() => switchMode('signup')}>
                                Créer un compte
                            </button>
                        </p>
                    )}
                    <div className="login-legal-links" style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <a href="/legal-notice" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Mentions légales</a>
                        {' | '}
                        <a href="/privacy-policy" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Confidentialité</a>
                        {' | '}
                        <a href="/terms" style={{ color: '#9ca3af', textDecoration: 'underline' }}>CGU</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
