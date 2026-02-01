// src/pages/MobileDiagnosticsPage.js
// Page de diagnostic pour identifier les problèmes d'upload sur mobile
import React from 'react';
import { ChevronLeftIcon } from '../components/SharedUI';
import logger from '../utils/logger';

export default function MobileDiagnosticsPage({
  diagnostics,
  report,
  testResults,
  testing,
  notificationStatus,
  onFileTest,
  onRequestNotificationPermission,
  onTestNotification,
  onGoBack
}) {

  const handleFileChange = (event) => {
    onFileTest(event.target.files[0]);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(report).then(() => {
      alert('Rapport copié ! Envoyez-le à votre administrateur.');
    });
  };

  const shareReport = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Diagnostic Mobile',
        text: report,
      }).catch(err => logger.error('Share failed:', err));
    } else {
      copyReport();
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await onRequestNotificationPermission();
      if (granted) {
        alert('✅ Permission accordée ! Vous pouvez maintenant tester les notifications.');
      } else {
        alert('❌ Permission refusée. Veuillez activer les notifications dans les paramètres de votre navigateur.');
      }
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const testNotify = async () => {
    try {
      await onTestNotification();
      alert('✅ Notification de test envoyée !');
    } catch (error) {
      alert('❌ Erreur: ' + error.message);
    }
  };

  if (!diagnostics) {
    return <div className="p-4">Chargement du diagnostic...</div>;
  }

  const hasErrors = diagnostics.errors.length > 0;
  const hasWarnings = diagnostics.warnings.length > 0;

  return (
    <div className="mobile-upload-page">
      <header className="mobile-upload-header">
        <button onClick={onGoBack} className="back-button">
          <ChevronLeftIcon />
        </button>
        <h2>Diagnostic Mobile</h2>
        <div style={{ width: 24 }}></div>
      </header>

      <main className="mobile-upload-content" style={{ padding: '1rem' }}>
        {/* Résumé */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor: hasErrors ? '#fee2e2' : hasWarnings ? '#fef3c7' : '#dcfce7',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
            {hasErrors ? '❌ Problèmes détectés' : hasWarnings ? '⚠️ Avertissements' : '✅ Tout fonctionne'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            {hasErrors
              ? 'Des problèmes empêchent l\'upload de fonctionner correctement.'
              : hasWarnings
                ? 'Votre appareil fonctionne mais avec des limitations.'
                : 'Votre appareil est compatible avec toutes les fonctionnalités.'}
          </p>
        </div>

        {/* Erreurs critiques */}
        {hasErrors && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#dc2626' }}>❌ Erreurs Critiques</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {diagnostics.errors.map((error, i) => (
                <li key={i} style={{ marginBottom: '0.25rem', color: '#991b1b' }}>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Avertissements */}
        {hasWarnings && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#d97706' }}>⚠️ Avertissements</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
              {diagnostics.warnings.map((warning, i) => (
                <li key={i} style={{ marginBottom: '0.25rem', color: '#92400e' }}>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Informations système */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>📱 Informations Système</h3>
          <div
            style={{
              fontSize: '0.875rem',
              backgroundColor: '#f9fafb',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              fontFamily: 'monospace',
            }}
          >
            <div>
              <strong>Appareil:</strong>{' '}
              {diagnostics.deviceInfo.isIOS ? 'iOS' : diagnostics.deviceInfo.isAndroid ? 'Android' : 'Desktop'}
            </div>
            <div>
              <strong>OS:</strong> {diagnostics.osVersion}
            </div>
            <div>
              <strong>Navigateur:</strong>{' '}
              {diagnostics.deviceInfo.isSafari
                ? 'Safari'
                : diagnostics.deviceInfo.isChrome
                  ? 'Chrome'
                  : diagnostics.deviceInfo.isFirefox
                    ? 'Firefox'
                    : 'Autre'}
            </div>
            <div>
              <strong>Connexion:</strong> {diagnostics.connection.online ? '✅ En ligne' : '❌ Hors ligne'} (
              {diagnostics.connection.effectiveType})
            </div>
            <div>
              <strong>Stockage:</strong> {diagnostics.storage.usage} / {diagnostics.storage.quota} (
              {diagnostics.storage.percentUsed})
            </div>
          </div>
        </div>

        {/* Test de notifications */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🔔 Notifications Push</h3>
          <div
            style={{
              fontSize: '0.875rem',
              backgroundColor: '#f9fafb',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              marginBottom: '0.5rem',
            }}
          >
            <div>
              <strong>Support:</strong> {notificationStatus.supported ? '✅ Supporté' : '❌ Non supporté'}
            </div>
            <div>
              <strong>Permission:</strong>{' '}
              {notificationStatus.permission === 'granted'
                ? '✅ Accordée'
                : notificationStatus.permission === 'denied'
                  ? '❌ Refusée'
                  : '⚠️ Pas encore demandée'}
            </div>
            <div>
              <strong>Statut:</strong> {notificationStatus.enabled ? '✅ Activées' : '❌ Désactivées'}
            </div>
          </div>
          {notificationStatus.supported && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!notificationStatus.enabled && (
                <button
                  onClick={requestPermission}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  Demander la permission
                </button>
              )}
              {notificationStatus.enabled && (
                <button
                  onClick={testNotify}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  🧪 Tester une notification
                </button>
              )}
            </div>
          )}
          {notificationStatus.permission === 'denied' && (
            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8125rem',
                color: '#dc2626',
                fontStyle: 'italic',
              }}
            >
              ⚠️ Pour activer les notifications, allez dans les paramètres de votre navigateur.
            </p>
          )}
        </div>

        {/* Test de fichier */}
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🧪 Test d'Upload</h3>
          <label
            style={{
              display: 'block',
              padding: '0.75rem',
              border: '2px dashed #cbd5e1',
              borderRadius: '0.375rem',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: 'white',
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={testing}
              style={{ display: 'none' }}
            />
            {testing ? 'Test en cours...' : 'Sélectionner une photo pour tester'}
          </label>

          {testResults && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: testResults.errors.length > 0 ? '#fee2e2' : '#dcfce7',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <strong>Fichier:</strong> {testResults.fileName} ({(testResults.fileSize / 1024).toFixed(2)} KB)
              </div>
              <div>
                <strong>Lecture:</strong> {testResults.canRead ? '✅' : '❌'}
              </div>
              {testResults.fileType.startsWith('image/') && (
                <div>
                  <strong>Compression:</strong> {testResults.canCompress ? '✅' : '❌'}
                  {testResults.compressedSize && ` (${(testResults.compressedSize / 1024).toFixed(2)} KB)`}
                </div>
              )}
              {testResults.errors.length > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#991b1b' }}>
                  <strong>Erreurs:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.5rem', padding: 0 }}>
                    {testResults.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={shareReport}
            className="btn btn-primary w-full"
            style={{
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            📤 Partager le rapport
          </button>

          <button
            onClick={copyReport}
            className="btn btn-secondary w-full"
            style={{
              padding: '0.75rem',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            📋 Copier le rapport
          </button>

          <details style={{ marginTop: '1rem' }}>
            <summary
              style={{
                cursor: 'pointer',
                padding: '0.5rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '0.375rem',
                fontWeight: '500',
              }}
            >
              Voir le rapport complet
            </summary>
            <pre
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}
            >
              {report}
            </pre>
          </details>
        </div>
      </main>
    </div>
  );
}
