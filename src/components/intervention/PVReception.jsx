// src/components/intervention/PVReception.jsx
import React, { useState, useEffect } from 'react';
import './PVReception.css';

/**
 * Composant pour créer et afficher un Procès-Verbal de Réception
 * S'adapte automatiquement aux données de l'intervention et du client
 */
const PVReception = ({ intervention, client, report, onSave, readOnly = false }) => {
  const [pvData, setPvData] = useState({
    type: '', // 'sans_reserve' | 'avec_reserves' | 'refuse'
    reserves: [],
    dateLeveeReserves: '',
    dateReception: new Date().toISOString().split('T')[0],
    signatureClient: false,
    signatureEntrepreneur: false
  });

  const [newReserve, setNewReserve] = useState('');

  // Charger les données du PV depuis le rapport si elles existent
  useEffect(() => {
    if (report?.pv_reception) {
      setPvData(report.pv_reception);
    }
  }, [report]);

  // Sauvegarder le PV
  const handleSave = () => {
    if (onSave) {
      onSave(pvData);
    }
  };

  // Ajouter une réserve
  const addReserve = () => {
    if (newReserve.trim()) {
      setPvData(prev => ({
        ...prev,
        reserves: [...prev.reserves, newReserve.trim()]
      }));
      setNewReserve('');
    }
  };

  // Supprimer une réserve
  const removeReserve = (index) => {
    setPvData(prev => ({
      ...prev,
      reserves: prev.reserves.filter((_, i) => i !== index)
    }));
  };

  // Changer le type de réception
  const handleTypeChange = (type) => {
    setPvData(prev => ({
      ...prev,
      type,
      reserves: type === 'sans_reserve' ? [] : prev.reserves
    }));
  };

  return (
    <div className="pv-reception-container">
      <div className="pv-header">
        <h3>📋 Procès-Verbal de Réception</h3>
        {pvData.type && (
          <span className={`pv-badge pv-badge-${pvData.type.replace('_', '-')}`}>
            {pvData.type === 'sans_reserve' && '✓ Sans réserve'}
            {pvData.type === 'avec_reserves' && '⚠ Avec réserves'}
            {pvData.type === 'refuse' && '✖ Refusé'}
          </span>
        )}
      </div>

      {/* Informations automatiques */}
      <div className="pv-info-section">
        <div className="pv-info-grid">
          <div className="pv-info-item">
            <label>Chantier</label>
            <div className="pv-info-value">{intervention?.address || '—'}</div>
          </div>
          <div className="pv-info-item">
            <label>Client</label>
            <div className="pv-info-value">{client?.name || intervention?.client || '—'}</div>
          </div>
          <div className="pv-info-item">
            <label>Date de réception</label>
            <input
              type="date"
              className="form-control"
              value={pvData.dateReception}
              onChange={(e) => setPvData(prev => ({ ...prev, dateReception: e.target.value }))}
              disabled={readOnly}
            />
          </div>
          <div className="pv-info-item">
            <label>Référence devis</label>
            <div className="pv-info-value">{intervention?.id || '—'}</div>
          </div>
        </div>
      </div>

      {/* Type de réception */}
      <div className="pv-section">
        <h4>1. Déclaration de réception</h4>
        <div className="pv-type-selector">
          <button
            className={`pv-type-btn ${pvData.type === 'sans_reserve' ? 'active success' : ''}`}
            onClick={() => !readOnly && handleTypeChange('sans_reserve')}
            disabled={readOnly}
          >
            <span className="pv-type-icon">✓</span>
            <span className="pv-type-label">Sans réserve</span>
          </button>
          <button
            className={`pv-type-btn ${pvData.type === 'avec_reserves' ? 'active warning' : ''}`}
            onClick={() => !readOnly && handleTypeChange('avec_reserves')}
            disabled={readOnly}
          >
            <span className="pv-type-icon">⚠</span>
            <span className="pv-type-label">Avec réserves</span>
          </button>
          <button
            className={`pv-type-btn ${pvData.type === 'refuse' ? 'active danger' : ''}`}
            onClick={() => !readOnly && handleTypeChange('refuse')}
            disabled={readOnly}
          >
            <span className="pv-type-icon">✖</span>
            <span className="pv-type-label">Refusé</span>
          </button>
        </div>
      </div>

      {/* Liste des réserves */}
      {pvData.type && pvData.type !== 'sans_reserve' && (
        <div className="pv-section">
          <h4>
            2. Liste des réserves {pvData.type === 'refuse' ? '/ Motifs de refus' : ''}
          </h4>

          {pvData.reserves.length === 0 ? (
            <div className="pv-empty-reserves">
              {readOnly ? 'NÉANT' : 'Aucune réserve ajoutée'}
            </div>
          ) : (
            <ol className="pv-reserves-list">
              {pvData.reserves.map((reserve, index) => (
                <li key={index}>
                  <span>{reserve}</span>
                  {!readOnly && (
                    <button
                      className="pv-remove-btn"
                      onClick={() => removeReserve(index)}
                      title="Supprimer"
                    >
                      ✖
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!readOnly && (
            <div className="pv-add-reserve">
              <input
                type="text"
                className="form-control"
                placeholder="Décrire la réserve (soyez précis)..."
                value={newReserve}
                onChange={(e) => setNewReserve(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addReserve()}
              />
              <button
                className="btn btn-secondary"
                onClick={addReserve}
                disabled={!newReserve.trim()}
              >
                Ajouter
              </button>
            </div>
          )}

          {pvData.type === 'avec_reserves' && (
            <div className="pv-date-levee">
              <label>Délai de levée des réserves</label>
              <input
                type="date"
                className="form-control"
                value={pvData.dateLeveeReserves}
                onChange={(e) => setPvData(prev => ({ ...prev, dateLeveeReserves: e.target.value }))}
                disabled={readOnly}
              />
            </div>
          )}
        </div>
      )}

      {/* Signatures */}
      {pvData.type && (
        <div className="pv-section">
          <h4>3. Signatures</h4>
          <div className="pv-signatures">
            <div className="pv-signature-box">
              <label>L'Entrepreneur</label>
              <div className="pv-signature-placeholder">
                {pvData.signatureEntrepreneur ? '✓ Signé' : 'En attente de signature'}
              </div>
              {!readOnly && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPvData(prev => ({ ...prev, signatureEntrepreneur: !prev.signatureEntrepreneur }))}
                >
                  {pvData.signatureEntrepreneur ? 'Annuler' : 'Signer'}
                </button>
              )}
            </div>
            <div className="pv-signature-box">
              <label>Le Client</label>
              <div className="pv-signature-placeholder">
                {pvData.signatureClient ? '✓ Signé' : 'En attente de signature'}
              </div>
              {!readOnly && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPvData(prev => ({ ...prev, signatureClient: !prev.signatureClient }))}
                >
                  {pvData.signatureClient ? 'Annuler' : 'Signer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conseils */}
      {!readOnly && pvData.type && (
        <div className="pv-tips">
          <div className="pv-tips-header">💡 Conseils professionnels</div>
          <ul>
            <li><strong>Nettoyage :</strong> Un chantier propre réduit les réserves de 50%</li>
            <li><strong>Précision :</strong> Soyez très précis dans les réserves (ex: "Éclat angle gauche carrelage")</li>
            <li><strong>Photos :</strong> Prenez des photos de tous les angles après signature du PV</li>
            {pvData.type === 'avec_reserves' && (
              <li><strong>5% :</strong> Le client peut consigner 5% du prix pour les réserves</li>
            )}
            <li><strong>Garanties :</strong> La signature déclenche la garantie décennale</li>
          </ul>
        </div>
      )}

      {/* Bouton de sauvegarde */}
      {!readOnly && pvData.type && (
        <div className="pv-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            Enregistrer le PV
          </button>
        </div>
      )}
    </div>
  );
};

export default PVReception;
