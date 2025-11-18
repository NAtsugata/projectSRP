// src/components/agenda/SavedFilters.js
// Composant pour gérer les filtres sauvegardés (presets)

import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import { BookmarkIcon, PlusIcon, XIcon, StarIcon } from '../SharedUI';
import { safeStorage } from '../../utils/safeStorage';
import './SavedFilters.css';

const STORAGE_KEY = 'agenda_saved_filters';

/**
 * Créer un preset de filtre par défaut
 */
const createDefaultPresets = (currentUserId) => [
  {
    id: 'my-interventions',
    name: 'Mes interventions',
    icon: '👤',
    filters: {
      employees: currentUserId ? [currentUserId] : [],
      showUrgentOnly: false,
      showSAVOnly: false,
      searchText: ''
    },
    isDefault: true
  },
  {
    id: 'urgent-only',
    name: 'Urgents uniquement',
    icon: '🚨',
    filters: {
      employees: [],
      showUrgentOnly: true,
      showSAVOnly: false,
      searchText: ''
    },
    isDefault: true
  },
  {
    id: 'sav-only',
    name: 'SAV à prévoir',
    icon: '🔧',
    filters: {
      employees: [],
      showUrgentOnly: false,
      showSAVOnly: true,
      searchText: ''
    },
    isDefault: true
  }
];

/**
 * SavedFilters Component
 * @param {Object} currentFilters - Filtres actuellement actifs
 * @param {Function} onApplyFilters - Callback pour appliquer des filtres
 * @param {string} currentUserId - ID de l'utilisateur connecté
 */
const SavedFilters = ({
  currentFilters = {},
  onApplyFilters,
  currentUserId
}) => {
  const [savedPresets, setSavedPresets] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📌');

  // Charger les presets sauvegardés au montage
  useEffect(() => {
    const stored = safeStorage.getJSON(STORAGE_KEY, []);
    const defaults = createDefaultPresets(currentUserId);

    // Merger defaults + customs
    const allPresets = [
      ...defaults,
      ...stored.filter(p => !p.isDefault)
    ];

    setSavedPresets(allPresets);
  }, [currentUserId]);

  // Sauvegarder dans localStorage
  const persistPresets = (presets) => {
    const customPresets = presets.filter(p => !p.isDefault);
    safeStorage.setJSON(STORAGE_KEY, customPresets);
  };

  // Appliquer un preset
  const handleApplyPreset = (preset) => {
    onApplyFilters(preset.filters);
  };

  // Créer un nouveau preset
  const handleCreatePreset = () => {
    if (!newPresetName.trim()) {
      alert('Veuillez entrer un nom pour ce filtre');
      return;
    }

    const newPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      icon: selectedIcon,
      filters: { ...currentFilters },
      isDefault: false
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistPresets(updated);

    // Reset
    setIsCreating(false);
    setNewPresetName('');
    setSelectedIcon('📌');
  };

  // Supprimer un preset custom
  const handleDeletePreset = (presetId) => {
    if (!confirm('Supprimer ce filtre sauvegardé ?')) return;

    const updated = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updated);
    persistPresets(updated);
  };

  // Vérifier si un preset est actif
  const isPresetActive = (preset) => {
    return JSON.stringify(preset.filters) === JSON.stringify(currentFilters);
  };

  const iconOptions = ['📌', '⭐', '🔖', '🎯', '📋', '🚨', '🔧', '👤', '👥', '🏢'];

  return (
    <div className="saved-filters">
      <div className="saved-filters-header">
        <BookmarkIcon className="header-icon" />
        <span className="header-title">Filtres rapides</span>
      </div>

      <div className="presets-grid">
        {savedPresets.map(preset => {
          const isActive = isPresetActive(preset);

          return (
            <div
              key={preset.id}
              className={`preset-card ${isActive ? 'active' : ''}`}
            >
              <button
                className="preset-button"
                onClick={() => handleApplyPreset(preset)}
                aria-label={`Appliquer le filtre ${preset.name}`}
              >
                <span className="preset-icon">{preset.icon}</span>
                <span className="preset-name">{preset.name}</span>
                {isActive && (
                  <StarIcon className="active-icon" />
                )}
              </button>

              {!preset.isDefault && (
                <button
                  className="preset-delete"
                  onClick={() => handleDeletePreset(preset.id)}
                  aria-label={`Supprimer ${preset.name}`}
                >
                  <XIcon />
                </button>
              )}
            </div>
          );
        })}

        {/* Bouton créer nouveau preset */}
        {!isCreating && (
          <button
            className="preset-card preset-create"
            onClick={() => setIsCreating(true)}
          >
            <PlusIcon className="create-icon" />
            <span className="create-text">Nouveau filtre</span>
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {isCreating && (
        <div className="preset-form">
          <div className="form-header">
            <h4 className="form-title">Nouveau filtre rapide</h4>
            <button
              className="form-close"
              onClick={() => setIsCreating(false)}
            >
              <XIcon />
            </button>
          </div>

          <div className="form-body">
            <div className="form-group">
              <label htmlFor="preset-name" className="form-label">
                Nom du filtre
              </label>
              <input
                id="preset-name"
                type="text"
                className="form-input"
                placeholder="Ex: Mon équipe du matin"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={30}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Icône</label>
              <div className="icon-picker">
                {iconOptions.map(icon => (
                  <button
                    key={icon}
                    className={`icon-option ${icon === selectedIcon ? 'selected' : ''}`}
                    onClick={() => setSelectedIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-info">
              ℹ️ Les filtres actuels seront sauvegardés :
              <ul className="info-list">
                {currentFilters.employees?.length > 0 && (
                  <li>{currentFilters.employees.length} intervenant(s)</li>
                )}
                {currentFilters.showUrgentOnly && <li>Urgents uniquement</li>}
                {currentFilters.showSAVOnly && <li>SAV uniquement</li>}
                {currentFilters.searchText && (
                  <li>Recherche: "{currentFilters.searchText}"</li>
                )}
                {!currentFilters.employees?.length &&
                  !currentFilters.showUrgentOnly &&
                  !currentFilters.showSAVOnly &&
                  !currentFilters.searchText && (
                  <li>Aucun filtre actif</li>
                )}
              </ul>
            </div>

            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setIsCreating(false)}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleCreatePreset}
                disabled={!newPresetName.trim()}
              >
                Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedFilters;
