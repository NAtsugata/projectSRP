// src/components/subsidy/ProjectTypeSelector.jsx
// Page d'accueil - Sélection du type de projet (comme CEDEO)

import React from 'react';
import './ProjectTypeSelector.css';

const ProjectTypeSelector = ({ onSelectType }) => {
  const projectTypes = [
    {
      id: 'house',
      icon: '🏠',
      title: 'Maison individuelle',
      description: 'Pour une maison individuelle',
    },
    {
      id: 'apartment',
      icon: '🏢',
      title: 'Appartement individuel',
      description: 'Pour un appartement',
    },
    {
      id: 'collective',
      icon: '🏘️',
      title: 'Résidentiel collectif',
      description: 'Bailleur - Copro - Syndic - Habitat Communautaire',
    },
    {
      id: 'business',
      icon: '🏭',
      title: 'Entreprise - Collectivité',
      description: 'Secteur Tertiaire',
    },
  ];

  return (
    <div className="project-type-selector">
      <div className="selector-header">
        <h2>Certificat d'économie d'énergie</h2>
        <p className="subtitle">Estimez le montant de votre prime en quelques secondes</p>
      </div>

      <div className="selector-content">
        <h3>Votre projet concerne :</h3>
        <div className="project-types-grid">
          {projectTypes.map((type) => (
            <button
              key={type.id}
              className="project-type-card"
              onClick={() => onSelectType(type.id)}
            >
              <div className="card-icon">{type.icon}</div>
              <h4>{type.title}</h4>
              <p>{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="selector-footer">
        <a href="#" className="link">CGU - Conditions générales d'utilisation</a>
      </div>
    </div>
  );
};

export default ProjectTypeSelector;
