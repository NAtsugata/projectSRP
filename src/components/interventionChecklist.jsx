// src/components/InterventionChecklist.js
import React from 'react';

/**
 * Affiche un formulaire de checklist dynamique basé sur un modèle.
 * @param {object} props
 * @param {object} props.template - Le modèle de checklist à afficher.
 * @param {object} props.checklistState - L'état actuel des valeurs de la checklist.
 * @param {function} props.onStateChange - Callback pour mettre à jour l'état.
 */
const InterventionChecklist = ({ template, checklistState, onStateChange }) => {

  const handleChange = (id, value) => {
    // Fait remonter le changement au composant parent (InterventionDetailView)
    onStateChange(prevState => ({
      ...prevState,
      [id]: value,
    }));
  };

  if (!template) return null;

  return (
    <div className="card-white" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <h3 className="view-title" style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e293b' }}>
        {template.title}
      </h3>
      {template.sections.map(section => (
        <div key={section.id} className="section checklist-section">
          <h4>{section.title}</h4>
          {section.items.map(item => (
            <div key={item.id} className="form-group">
              {item.type === 'checkbox' && (
                <label className="checklist-item-checkbox">
                  <input
                    type="checkbox"
                    checked={!!checklistState[item.id]}
                    onChange={(e) => handleChange(item.id, e.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              )}
              {item.type === 'text' && (
                 <label>
                  {item.label}
                  <input
                    type="text"
                    className="form-control mt-2"
                    value={checklistState[item.id] || ''}
                    onChange={(e) => handleChange(item.id, e.target.value)}
                    placeholder="Saisir la valeur..."
                  />
                </label>
              )}
              {item.type === 'textarea' && (
                <label>
                  {item.label}
                  <textarea
                    className="form-control mt-2"
                    rows="4"
                    value={checklistState[item.id] || ''}
                    onChange={(e) => handleChange(item.id, e.target.value)}
                    placeholder="Saisissez vos remarques ici..."
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default InterventionChecklist;
