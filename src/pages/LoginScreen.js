import React, { useState, useEffect } from 'react';
import { authService } from '../lib/supabase';

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
            console.log('Tentative de connexion...');
            
            // ✅ CORRIGÉ: Suppression du nettoyage manuel du localStorage.
            // La librairie Supabase gère cela automatiquement.
            const { error: signInError } = await authService.signIn(email, password);
            
            if (signInError) {
                console.error('Erreur de connexion:', signInError);
                // L'erreur "Failed to fetch" est souvent liée à un problème réseau ou de CORS.
                // 1. Vérifiez que l'URL et la clé de votre projet Supabase sont correctes dans le fichier .env
                // 2. Assurez-vous que http://localhost:3000 est autorisé dans les réglages d'authentification de Supabase.
                // 3. Désactivez les bloqueurs de pub ou VPN qui pourraient interférer.
                setError('Email ou mot de passe incorrect, ou problème de connexion.');
            } else {
                console.log('Connexion réussie, attente de la redirection...');
                // La redirection est maintenant gérée par le listener onAuthStateChange dans App.js
            }
        } catch (error) {
            console.error('Erreur lors de la connexion:', error);
            setError('Erreur de connexion. Veuillez réessayer.');
        }
        
        setLoading(false);
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
            <div className="login-card">
                <div className="login-header">
                    <h1>Entreprise SRP</h1>
                    <p>Connectez-vous à votre espace employé</p>
                </div>
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label>Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={handleEmailChange}
                            className="form-control" 
                            required 
                            autoComplete="email"
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label>Mot de passe</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={handlePasswordChange}
                            className="form-control" 
                            required 
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button 
                        type="submit" 
                        disabled={loading || !email || !password} 
                        className="btn btn-primary w-full"
                    >
                        {loading ? 'Connexion...' : 'Connexion'}
                    </button>
                </form>
            </div>
        </div>
    );
}
