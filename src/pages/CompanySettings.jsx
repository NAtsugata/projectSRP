// =============================
// FILE: src/pages/CompanySettings.jsx
// Page de configuration entreprise et assurance
// =============================

import React, { useState, useEffect } from 'react';
import './CompanySettings.css';

const CompanySettings = () => {
  const [companyData, setCompanyData] = useState({
    // Informations entreprise
    name: '',
    address: '',
    siret: '',
    phone: '',
    email: '',

    // Informations assurance décennale
    assuranceCompany: '',
    assuranceNumClient: '',
    assuranceNumSocietaire: '',
    assuranceNumContrat: '',
    assuranceValiditeDebut: '',
    assuranceValiditeFin: '',
    assuranceActivites: '',

    // Montants de garantie
    assuranceDecennaleHabitation: '',
    assuranceDecennaleHorsHabitation: '',
    assuranceBonFonctionnement: '',
    assuranceRC: '',
  });

  const [isSaved, setIsSaved] = useState(false);

  // Charger les données depuis localStorage
  useEffect(() => {
    const savedData = {
      name: localStorage.getItem('companyName') || '',
      address: localStorage.getItem('companyAddress') || '',
      siret: localStorage.getItem('companySiret') || '',
      phone: localStorage.getItem('companyPhone') || '',
      email: localStorage.getItem('companyEmail') || '',
      assuranceCompany: localStorage.getItem('companyAssuranceCompany') || '',
      assuranceNumClient: localStorage.getItem('companyAssuranceNumClient') || '',
      assuranceNumSocietaire: localStorage.getItem('companyAssuranceNumSocietaire') || '',
      assuranceNumContrat: localStorage.getItem('companyAssuranceNumContrat') || '',
      assuranceValiditeDebut: localStorage.getItem('companyAssuranceValiditeDebut') || '',
      assuranceValiditeFin: localStorage.getItem('companyAssuranceValiditeFin') || '',
      assuranceActivites: localStorage.getItem('companyAssuranceActivites') || '',
      assuranceDecennaleHabitation: localStorage.getItem('companyAssuranceDecennaleHabitation') || '',
      assuranceDecennaleHorsHabitation: localStorage.getItem('companyAssuranceDecennaleHorsHabitation') || '',
      assuranceBonFonctionnement: localStorage.getItem('companyAssuranceBonFonctionnement') || '',
      assuranceRC: localStorage.getItem('companyAssuranceRC') || '',
    };
    setCompanyData(savedData);
  }, []);

  // Sauvegarder les données
  const handleSave = () => {
    localStorage.setItem('companyName', companyData.name);
    localStorage.setItem('companyAddress', companyData.address);
    localStorage.setItem('companySiret', companyData.siret);
    localStorage.setItem('companyPhone', companyData.phone);
    localStorage.setItem('companyEmail', companyData.email);
    localStorage.setItem('companyAssuranceCompany', companyData.assuranceCompany);
    localStorage.setItem('companyAssuranceNumClient', companyData.assuranceNumClient);
    localStorage.setItem('companyAssuranceNumSocietaire', companyData.assuranceNumSocietaire);
    localStorage.setItem('companyAssuranceNumContrat', companyData.assuranceNumContrat);
    localStorage.setItem('companyAssuranceValiditeDebut', companyData.assuranceValiditeDebut);
    localStorage.setItem('companyAssuranceValiditeFin', companyData.assuranceValiditeFin);
    localStorage.setItem('companyAssuranceActivites', companyData.assuranceActivites);
    localStorage.setItem('companyAssuranceDecennaleHabitation', companyData.assuranceDecennaleHabitation);
    localStorage.setItem('companyAssuranceDecennaleHorsHabitation', companyData.assuranceDecennaleHorsHabitation);
    localStorage.setItem('companyAssuranceBonFonctionnement', companyData.assuranceBonFonctionnement);
    localStorage.setItem('companyAssuranceRC', companyData.assuranceRC);

    // Construire le texte complet de l'assurance décennale pour compatibilité
    const assuranceDecennaleText = `${companyData.assuranceCompany} - Contrat n°${companyData.assuranceNumContrat} - Valide du ${companyData.assuranceValiditeDebut} au ${companyData.assuranceValiditeFin}`;
    localStorage.setItem('companyAssuranceDecennale', assuranceDecennaleText);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Pré-remplir avec les données de l'attestation fournie
  const handleAutoFill = () => {
    setCompanyData({
      name: 'SARL SRP',
      address: '422 ROUTE DE DIGNE LA CLEDE 04660 CHAMPTERCIER',
      siret: '909670994',
      phone: companyData.phone || '',
      email: companyData.email || '',
      assuranceCompany: 'L\'Auxiliaire',
      assuranceNumClient: '428637',
      assuranceNumSocietaire: '934797',
      assuranceNumContrat: '020.220041',
      assuranceValiditeDebut: '01/01/2026',
      assuranceValiditeFin: '31/12/2026',
      assuranceActivites: 'Platrerie-Staff-Stuc-Gypserie, Plomberie Installations sanitaires, Installations thermiques de genie climatique, Installations d\'aeraulique et de conditionnement d\'air',
      assuranceDecennaleHabitation: 'Cout total des travaux de reparation',
      assuranceDecennaleHorsHabitation: '15 000 000 EUR (limite)',
      assuranceBonFonctionnement: '1 000 000 EUR par sinistre',
      assuranceRC: '8 000 000 EUR (corporels), 900 000 EUR (materiels)',
    });
  };

  const handleChange = (field, value) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="company-settings-container">
      <div className="company-settings-header">
        <h1>⚙️ Configuration Entreprise</h1>
        <p>Informations de l'entreprise et de l'assurance décennale</p>
      </div>

      <div className="company-settings-content">
        {/* Section Informations Entreprise */}
        <div className="settings-section">
          <h2>🏢 Informations de l'entreprise</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Nom de l'entreprise *</label>
              <input
                type="text"
                className="form-control"
                value={companyData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="SARL SRP"
              />
            </div>

            <div className="form-group">
              <label>SIRET *</label>
              <input
                type="text"
                className="form-control"
                value={companyData.siret}
                onChange={(e) => handleChange('siret', e.target.value)}
                placeholder="909670994"
              />
            </div>

            <div className="form-group full-width">
              <label>Adresse complète *</label>
              <input
                type="text"
                className="form-control"
                value={companyData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="422 ROUTE DE DIGNE LA CLEDE 04660 CHAMPTERCIER"
              />
            </div>

            <div className="form-group">
              <label>Téléphone</label>
              <input
                type="tel"
                className="form-control"
                value={companyData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="04 XX XX XX XX"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                value={companyData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@exemple.fr"
              />
            </div>
          </div>
        </div>

        {/* Section Assurance Décennale */}
        <div className="settings-section">
          <h2>🛡️ Assurance Décennale</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Compagnie d'assurance *</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceCompany}
                onChange={(e) => handleChange('assuranceCompany', e.target.value)}
                placeholder="L'Auxiliaire"
              />
            </div>

            <div className="form-group">
              <label>N° Client</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceNumClient}
                onChange={(e) => handleChange('assuranceNumClient', e.target.value)}
                placeholder="428637"
              />
            </div>

            <div className="form-group">
              <label>N° Sociétaire</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceNumSocietaire}
                onChange={(e) => handleChange('assuranceNumSocietaire', e.target.value)}
                placeholder="934797"
              />
            </div>

            <div className="form-group">
              <label>N° Contrat *</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceNumContrat}
                onChange={(e) => handleChange('assuranceNumContrat', e.target.value)}
                placeholder="020.220041"
              />
            </div>

            <div className="form-group">
              <label>Validité début</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceValiditeDebut}
                onChange={(e) => handleChange('assuranceValiditeDebut', e.target.value)}
                placeholder="01/01/2026"
              />
            </div>

            <div className="form-group">
              <label>Validité fin</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceValiditeFin}
                onChange={(e) => handleChange('assuranceValiditeFin', e.target.value)}
                placeholder="31/12/2026"
              />
            </div>

            <div className="form-group full-width">
              <label>Activités couvertes</label>
              <textarea
                className="form-control"
                rows={3}
                value={companyData.assuranceActivites}
                onChange={(e) => handleChange('assuranceActivites', e.target.value)}
                placeholder="Platrerie, Plomberie, Installations thermiques..."
              />
            </div>
          </div>
        </div>

        {/* Section Montants de Garantie */}
        <div className="settings-section">
          <h2>💰 Montants de Garantie</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Décennale Habitation</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceDecennaleHabitation}
                onChange={(e) => handleChange('assuranceDecennaleHabitation', e.target.value)}
                placeholder="Cout total reparation"
              />
            </div>

            <div className="form-group">
              <label>Décennale Hors Habitation</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceDecennaleHorsHabitation}
                onChange={(e) => handleChange('assuranceDecennaleHorsHabitation', e.target.value)}
                placeholder="15 000 000 EUR"
              />
            </div>

            <div className="form-group">
              <label>Bon Fonctionnement (2 ans)</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceBonFonctionnement}
                onChange={(e) => handleChange('assuranceBonFonctionnement', e.target.value)}
                placeholder="1 000 000 EUR"
              />
            </div>

            <div className="form-group">
              <label>RC (dommages extérieurs)</label>
              <input
                type="text"
                className="form-control"
                value={companyData.assuranceRC}
                onChange={(e) => handleChange('assuranceRC', e.target.value)}
                placeholder="8 000 000 EUR"
              />
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleAutoFill}>
            📋 Pré-remplir avec attestation fournie
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            💾 Enregistrer la configuration
          </button>
        </div>

        {isSaved && (
          <div className="save-success">
            ✅ Configuration enregistrée avec succès !
          </div>
        )}

        {/* Informations d'utilisation */}
        <div className="settings-info">
          <h3>ℹ️ Utilisation</h3>
          <p>Ces informations seront automatiquement utilisées dans :</p>
          <ul>
            <li>Les Procès-Verbaux de Réception (section assurance décennale)</li>
            <li>Les documents CERFA</li>
            <li>Les devis et factures</li>
            <li>Tous les documents officiels générés</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CompanySettings;
