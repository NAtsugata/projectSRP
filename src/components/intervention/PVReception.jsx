// src/components/intervention/PVReception.jsx
import React, { useState, useEffect } from 'react';
import SignaturePad from '../SignaturePad';
import { generatePVReceptionPDF, downloadPVPDF } from '../../utils/pvService';
import logger from '../../utils/logger';
import './PVReception.css';

/**
 * Composant pour créer et afficher un Procès-Verbal de Réception
 * Conforme aux exigences légales du Code Civil (Articles 1792 et suivants)
 */
const PVReception = ({ intervention, client, report, onSave, readOnly = false }) => {
  const [pvData, setPvData] = useState({
    type: '', // 'sans_reserve' | 'avec_reserves' | 'refuse'
    reserves: [],
    dateLeveeReserves: '',
    dateReception: new Date().toISOString().split('T')[0],

    // Informations détaillées des travaux
    travauxDescription: '',
    devisReference: '',
    montantTravaux: '',
    dateDebut: '',
    dateFin: '',

    // Informations signatures
    signatureClient: null, // Base64 de la signature
    signatureEntrepreneur: null, // Base64 de la signature
    nomClient: '',
    nomEntrepreneur: '',
    dateSignatureClient: '',
    dateSignatureEntrepreneur: '',

    // Assurances
    assuranceDecennale: '',
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [newReserve, setNewReserve] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Charger les données du PV depuis le rapport si elles existent
  useEffect(() => {
    if (report?.pv_reception) {
      setPvData(prev => ({
        ...prev,
        ...report.pv_reception
      }));
    } else {
      // Pré-remplir avec les données de l'intervention
      setPvData(prev => ({
        ...prev,
        travauxDescription: intervention?.description || '',
        devisReference: intervention?.id || '',
        montantTravaux: intervention?.totalPrice || '',
        dateDebut: intervention?.startDate || '',
        dateFin: intervention?.date || intervention?.endDate || '',
        nomClient: client?.name || intervention?.client || '',
      }));
    }
    setIsInitialized(true);
  }, [report, intervention, client]);

  // Sauvegarder automatiquement quand pvData change (avec debounce)
  useEffect(() => {
    if (!isInitialized) return; // Ne pas sauvegarder pendant l'initialisation

    const timeoutId = setTimeout(() => {
      if (onSave) {
        onSave(pvData);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
  }, [pvData, onSave, isInitialized]);

  // Sauvegarder le PV
  const handleSave = () => {
    if (onSave) {
      onSave(pvData);
    }
  };

  // Générer et télécharger le PDF
  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      logger.log('[PV] Génération PDF...', pvData);

      // Récupérer les infos de l'entreprise (depuis localStorage ou config)
      const companyData = {
        name: localStorage.getItem('companyName') || 'Nom de l\'entreprise',
        address: localStorage.getItem('companyAddress') || '',
        siret: localStorage.getItem('companySiret') || '',
        phone: localStorage.getItem('companyPhone') || '',
        email: localStorage.getItem('companyEmail') || '',
        assuranceDecennale: localStorage.getItem('companyAssuranceDecennale') || '',
      };

      const pdfBytes = await generatePVReceptionPDF(pvData, intervention, client, companyData);

      const filename = `PV-Reception-${intervention?.id || 'Document'}-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadPVPDF(pdfBytes, filename);

      logger.log('[PV] PDF généré et téléchargé');
      alert('✓ PDF du Procès-Verbal généré avec succès');
    } catch (error) {
      logger.log('[PV] Erreur génération PDF', error);
      alert('✗ Erreur lors de la génération du PDF: ' + error.message);
    } finally {
      setIsGeneratingPDF(false);
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

  // Vérifier si une signature est valide
  const isSignatureValid = (signature) => {
    return signature && typeof signature === 'string' && signature.length > 0;
  };

  // Vérifier si les deux signatures sont valides
  const areBothSignaturesValid = () => {
    return isSignatureValid(pvData.signatureClient) && isSignatureValid(pvData.signatureEntrepreneur);
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
            4. Liste des réserves {pvData.type === 'refuse' ? '/ Motifs de refus' : ''}
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

      {/* Informations détaillées des travaux */}
      {pvData.type && (
        <div className="pv-section">
          <h4>2. Informations détaillées des travaux</h4>
          <div className="pv-form-grid">
            <div className="pv-form-group">
              <label>Description des travaux</label>
              <textarea
                className="form-control"
                rows={3}
                value={pvData.travauxDescription}
                onChange={(e) => setPvData(prev => ({ ...prev, travauxDescription: e.target.value }))}
                disabled={readOnly}
                placeholder="Description détaillée des travaux réalisés..."
              />
            </div>

            <div className="pv-form-row">
              <div className="pv-form-group">
                <label>Référence devis/marché</label>
                <input
                  type="text"
                  className="form-control"
                  value={pvData.devisReference}
                  onChange={(e) => setPvData(prev => ({ ...prev, devisReference: e.target.value }))}
                  disabled={readOnly}
                />
              </div>

              <div className="pv-form-group">
                <label>Montant des travaux (€)</label>
                <input
                  type="text"
                  className="form-control"
                  value={pvData.montantTravaux}
                  onChange={(e) => setPvData(prev => ({ ...prev, montantTravaux: e.target.value }))}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="pv-form-row">
              <div className="pv-form-group">
                <label>Date début travaux</label>
                <input
                  type="date"
                  className="form-control"
                  value={pvData.dateDebut}
                  onChange={(e) => setPvData(prev => ({ ...prev, dateDebut: e.target.value }))}
                  disabled={readOnly}
                />
              </div>

              <div className="pv-form-group">
                <label>Date fin travaux</label>
                <input
                  type="date"
                  className="form-control"
                  value={pvData.dateFin}
                  onChange={(e) => setPvData(prev => ({ ...prev, dateFin: e.target.value }))}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="pv-form-group">
              <label>Assurance décennale</label>
              <input
                type="text"
                className="form-control"
                value={pvData.assuranceDecennale}
                onChange={(e) => setPvData(prev => ({ ...prev, assuranceDecennale: e.target.value }))}
                disabled={readOnly}
                placeholder="Compagnie, N° police, validité..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Signatures numériques */}
      {pvData.type && (
        <div className="pv-section">
          <h4>3. Signatures numériques</h4>
          <div className="pv-legal-notice">
            <small>
              ⚖️ La signature marque le point de départ des garanties légales :
              Parfait achèvement (1 an), Bon fonctionnement (2 ans), Décennale (10 ans)
            </small>
          </div>

          <div className="pv-signatures">
            <div className="pv-signature-box">
              <label>L'Entrepreneur</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nom et qualité du signataire"
                value={pvData.nomEntrepreneur}
                onChange={(e) => setPvData(prev => ({ ...prev, nomEntrepreneur: e.target.value }))}
                disabled={readOnly}
                style={{ marginBottom: '10px' }}
              />
              {!readOnly ? (
                <SignaturePad
                  onSave={(signature) => {
                    setPvData(prev => ({
                      ...prev,
                      signatureEntrepreneur: signature,
                      dateSignatureEntrepreneur: new Date().toISOString()
                    }));
                  }}
                  onClear={() => {
                    setPvData(prev => ({
                      ...prev,
                      signatureEntrepreneur: null,
                      dateSignatureEntrepreneur: ''
                    }));
                  }}
                  initialValue={pvData.signatureEntrepreneur}
                  width={400}
                  height={150}
                />
              ) : (
                <div className="pv-signature-readonly">
                  {pvData.signatureEntrepreneur ? (
                    <img src={pvData.signatureEntrepreneur} alt="Signature entrepreneur" />
                  ) : (
                    <div className="pv-no-signature">Non signé</div>
                  )}
                </div>
              )}
              {pvData.dateSignatureEntrepreneur && (
                <div className="pv-signature-date">
                  Signé le {new Date(pvData.dateSignatureEntrepreneur).toLocaleString('fr-FR')}
                </div>
              )}
            </div>

            <div className="pv-signature-box">
              <label>Le Maître d'Ouvrage (Client)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nom et qualité du signataire"
                value={pvData.nomClient}
                onChange={(e) => setPvData(prev => ({ ...prev, nomClient: e.target.value }))}
                disabled={readOnly}
                style={{ marginBottom: '10px' }}
              />
              {!readOnly ? (
                <SignaturePad
                  onSave={(signature) => {
                    setPvData(prev => ({
                      ...prev,
                      signatureClient: signature,
                      dateSignatureClient: new Date().toISOString()
                    }));
                  }}
                  onClear={() => {
                    setPvData(prev => ({
                      ...prev,
                      signatureClient: null,
                      dateSignatureClient: ''
                    }));
                  }}
                  initialValue={pvData.signatureClient}
                  width={400}
                  height={150}
                />
              ) : (
                <div className="pv-signature-readonly">
                  {pvData.signatureClient ? (
                    <img src={pvData.signatureClient} alt="Signature client" />
                  ) : (
                    <div className="pv-no-signature">Non signé</div>
                  )}
                </div>
              )}
              {pvData.dateSignatureClient && (
                <div className="pv-signature-date">
                  Signé le {new Date(pvData.dateSignatureClient).toLocaleString('fr-FR')}
                </div>
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

      {/* Mentions légales */}
      {pvData.type && (
        <div className="pv-section pv-legal-section">
          <h4>⚖️ Mentions légales</h4>
          <div className="pv-legal-text">
            <p><strong>Point de départ des garanties légales :</strong></p>
            <ul>
              <li><strong>Garantie de parfait achèvement (1 an)</strong> - Article 1792-6 du Code Civil<br />
                <small>Couvre tous les désordres signalés pendant la première année</small>
              </li>
              <li><strong>Garantie de bon fonctionnement (2 ans)</strong> - Article 1792-3 du Code Civil<br />
                <small>Couvre les éléments d'équipement dissociables</small>
              </li>
              <li><strong>Garantie décennale (10 ans)</strong> - Article 1792 du Code Civil<br />
                <small>Couvre les dommages compromettant la solidité ou rendant l'ouvrage impropre à sa destination</small>
              </li>
            </ul>
            {pvData.type === 'avec_reserves' && (
              <p className="pv-legal-highlight">
                <strong>⚠️ Consignation :</strong> En cas de réception avec réserves, le maître d'ouvrage peut consigner
                jusqu'à 5% du montant total des travaux jusqu'à la levée complète des réserves.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Boutons d'actions */}
      {!readOnly && pvData.type && (
        <div className="pv-actions">
          <button className="btn btn-secondary" onClick={handleSave}>
            💾 Enregistrer le PV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF || !areBothSignaturesValid()}
          >
            {isGeneratingPDF ? '⏳ Génération...' : '📄 Générer le PDF'}
          </button>
        </div>
      )}

      {!readOnly && pvData.type && !areBothSignaturesValid() && (
        <div className="pv-warning">
          ⚠️ Les deux signatures sont requises pour générer le PDF
        </div>
      )}

      {readOnly && pvData.type && (
        <div className="pv-actions">
          <button
            className="btn btn-primary"
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? '⏳ Génération...' : '📄 Télécharger le PDF'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PVReception;
