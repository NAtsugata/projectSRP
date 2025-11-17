// src/components/SectionErrorBoundary.js
// ErrorBoundary pour les sections spécifiques (non-bloquant)

import React from 'react';
import logger from '../utils/logger';

/**
 * ErrorBoundary pour sections spécifiques
 * Affiche un fallback UI sans bloquer toute l'application
 */
class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error(`🚨 Erreur dans ${this.props.section || 'section'}:`, error, errorInfo);

    this.setState({ error });

    // En production, envoyer à un service de monitoring
    if (process.env.NODE_ENV === 'production') {
      // sendToErrorTracking(error, { section: this.props.section, ...errorInfo });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personnalisée ou par défaut
      if (this.props.fallback) {
        return this.props.fallback(this.handleRetry);
      }

      // UI de fallback par défaut
      return (
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            textAlign: 'center',
            margin: '1rem 0'
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.5rem' }}>
            {this.props.title || 'Erreur de chargement'}
          </h3>
          <p style={{ color: '#7f1d1d', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {this.props.message || 'Une erreur s\'est produite lors du chargement de cette section.'}
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '0.75rem'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#991b1b' }}>
                Détails (dev)
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#7f1d1d',
                fontSize: '0.7rem'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC pour wrapper facilement un composant avec ErrorBoundary
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return function WithErrorBoundary(props) {
    return (
      <SectionErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </SectionErrorBoundary>
    );
  };
};

export default SectionErrorBoundary;
