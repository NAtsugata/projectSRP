import React, { useState } from 'react';
import { authService } from '../lib/supabase';
import { BriefcaseIcon, MailIcon, LockIcon, AlertTriangleIcon } from '../components/SharedUI';
import './LoginScreen.css';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: signInError } = await authService.signIn(email, password);

            if (signInError) {
                setError('Email ou mot de passe incorrect. Veuillez réessayer.');
            }
            // La redirection est gérée par App.js via onAuthStateChange
        } catch (error) {
            setError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        if (error) setError('');
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        if (error) setError('');
    };

    return (
        <div className="login-screen-container">
            {/* Animated background */}
            <div className="login-background">
                <div className="gradient-orb gradient-orb-1"></div>
                <div className="gradient-orb gradient-orb-2"></div>
                <div className="gradient-orb gradient-orb-3"></div>
            </div>

            {/* Login card */}
            <div className="login-card">
                {/* Logo & branding */}
                <div className="login-header">
                    <div className="logo-container">
                        <div className="logo-icon">
                            <BriefcaseIcon size={40} />
                        </div>
                        <h1 className="logo-text">Portail SRP</h1>
                    </div>
                    <p className="tagline">Gestion des interventions terrain</p>
                </div>

                {/* Login form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {/* Email input */}
                    <div className="login-input-group">
                        <label>
                            <span className="label-icon">
                                <MailIcon size={16} />
                            </span>
                            Adresse email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={handleEmailChange}
                            className={`login-input ${error ? 'input-error' : ''}`}
                            placeholder="votre@email.com"
                            required
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>

                    {/* Password input */}
                    <div className="login-input-group">
                        <label>
                            <span className="label-icon">
                                <LockIcon size={16} />
                            </span>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={handlePasswordChange}
                            className={`login-input ${error ? 'input-error' : ''}`}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="login-error">
                            <AlertTriangleIcon size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className={`login-submit-btn ${loading ? 'btn-loading' : ''}`}
                    >
                        {!loading && 'Se connecter'}
                    </button>
                </form>

                {/* Footer */}
                <div className="login-footer">
                    <p>
                        Besoin d'aide ? Contactez votre administrateur
                    </p>
                </div>
            </div>
        </div>
    );
}
