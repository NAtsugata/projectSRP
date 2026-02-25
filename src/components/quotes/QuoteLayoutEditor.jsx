// =============================
// FILE: src/components/quotes/QuoteLayoutEditor.jsx
// Éditeur de mise en page pour personnaliser les devis
// =============================
import React, { useState, useCallback } from 'react';
import './QuoteLayoutEditor.css';

// Configuration par défaut des sections
const DEFAULT_SECTIONS = [
  { id: 'header', label: 'En-tête', icon: '📋', required: true },
  { id: 'client', label: 'Informations client', icon: '👤', required: true },
  { id: 'dates', label: 'Dates', icon: '📅', required: false },
  { id: 'items', label: 'Lignes du devis', icon: '📝', required: true },
  { id: 'totals', label: 'Totaux', icon: '💰', required: true },
  { id: 'attachments', label: 'Pièces jointes', icon: '📎', required: false },
  { id: 'notes', label: 'Notes', icon: '📌', required: false },
  { id: 'terms', label: 'Conditions', icon: '📜', required: false },
  { id: 'signature', label: 'Zone signature', icon: '✍️', required: false }
];

// Thèmes disponibles
const THEMES = [
  { id: 'default', label: 'Standard', preview: '#3b82f6' },
  { id: 'modern', label: 'Moderne', preview: '#8b5cf6' },
  { id: 'classic', label: 'Classique', preview: '#059669' },
  { id: 'minimal', label: 'Minimaliste', preview: '#6b7280' },
  { id: 'bold', label: 'Audacieux', preview: '#dc2626' }
];

// Layout par défaut
export const DEFAULT_LAYOUT = {
  sections: DEFAULT_SECTIONS.map((s, i) => ({
    id: s.id,
    visible: s.id !== 'signature',
    order: i
  })),
  theme: 'default',
  showLogo: true,
  showSignatureZone: false,
  attachmentDisplay: 'end', // 'inline', 'end', 'separate'
  fontSize: 'medium', // 'small', 'medium', 'large'
  pageMargins: 'normal' // 'narrow', 'normal', 'wide'
};

function QuoteLayoutEditor({
  layout = DEFAULT_LAYOUT,
  onLayoutChange,
  isOpen,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('sections'); // sections, style, options
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Fusionner avec les valeurs par défaut
  const currentLayout = {
    ...DEFAULT_LAYOUT,
    ...layout,
    sections: layout?.sections || DEFAULT_LAYOUT.sections
  };

  // Obtenir les sections triées par ordre
  const getSortedSections = () => {
    return [...currentLayout.sections]
      .sort((a, b) => a.order - b.order)
      .map(section => ({
        ...section,
        ...DEFAULT_SECTIONS.find(s => s.id === section.id)
      }));
  };

  // Mettre à jour une valeur du layout
  const updateLayout = useCallback((key, value) => {
    onLayoutChange?.({
      ...currentLayout,
      [key]: value
    });
  }, [currentLayout, onLayoutChange]);

  // Mettre à jour une section
  const updateSection = useCallback((sectionId, field, value) => {
    const updatedSections = currentLayout.sections.map(s =>
      s.id === sectionId ? { ...s, [field]: value } : s
    );
    updateLayout('sections', updatedSections);
  }, [currentLayout.sections, updateLayout]);

  // Déplacer une section
  const moveSection = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const sorted = getSortedSections();
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);

    const reordered = sorted.map((s, i) => ({
      id: s.id,
      visible: s.visible,
      order: i
    }));

    updateLayout('sections', reordered);
  }, [getSortedSections, updateLayout]);

  // Drag & Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveSection(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (!isOpen) return null;

  const sortedSections = getSortedSections();

  return (
    <div className="layout-editor-overlay" onClick={onClose}>
      <div className="layout-editor" onClick={(e) => e.stopPropagation()}>
        <div className="layout-editor-header">
          <h2>Personnaliser la mise en page</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="layout-tabs">
          <button
            className={`tab ${activeTab === 'sections' ? 'active' : ''}`}
            onClick={() => setActiveTab('sections')}
          >
            Sections
          </button>
          <button
            className={`tab ${activeTab === 'style' ? 'active' : ''}`}
            onClick={() => setActiveTab('style')}
          >
            Style
          </button>
          <button
            className={`tab ${activeTab === 'options' ? 'active' : ''}`}
            onClick={() => setActiveTab('options')}
          >
            Options
          </button>
        </div>

        <div className="layout-editor-content">
          {/* Tab: Sections */}
          {activeTab === 'sections' && (
            <div className="sections-tab">
              <p className="tab-description">
                Réorganisez les sections par glisser-déposer. Activez ou désactivez leur affichage.
              </p>

              <div className="sections-list">
                {sortedSections.map((section, index) => (
                  <div
                    key={section.id}
                    className={`section-item ${draggedIndex === index ? 'dragging' : ''} ${section.required ? 'required' : ''}`}
                    draggable={!section.required}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="drag-handle">⋮⋮</span>

                    <span className="section-icon">{section.icon}</span>
                    <span className="section-label">{section.label}</span>

                    {section.required ? (
                      <span className="required-badge">Obligatoire</span>
                    ) : (
                      <label className="visibility-toggle">
                        <input
                          type="checkbox"
                          checked={section.visible}
                          onChange={(e) => updateSection(section.id, 'visible', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    )}

                    <div className="section-actions">
                      <button
                        className="move-btn"
                        onClick={() => moveSection(index, index - 1)}
                        disabled={index === 0}
                        title="Monter"
                      >
                        ↑
                      </button>
                      <button
                        className="move-btn"
                        onClick={() => moveSection(index, index + 1)}
                        disabled={index === sortedSections.length - 1}
                        title="Descendre"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Style */}
          {activeTab === 'style' && (
            <div className="style-tab">
              <p className="tab-description">
                Choisissez l'apparence visuelle de vos devis PDF.
              </p>

              <div className="style-section">
                <h4>Thème</h4>
                <div className="theme-grid">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${currentLayout.theme === theme.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('theme', theme.id)}
                    >
                      <span
                        className="theme-preview"
                        style={{ backgroundColor: theme.preview }}
                      />
                      <span className="theme-label">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-section">
                <h4>Taille du texte</h4>
                <div className="button-group">
                  {[
                    { id: 'small', label: 'Petit' },
                    { id: 'medium', label: 'Moyen' },
                    { id: 'large', label: 'Grand' }
                  ].map(size => (
                    <button
                      key={size.id}
                      className={`option-btn ${currentLayout.fontSize === size.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('fontSize', size.id)}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-section">
                <h4>Marges</h4>
                <div className="button-group">
                  {[
                    { id: 'narrow', label: 'Étroites' },
                    { id: 'normal', label: 'Normales' },
                    { id: 'wide', label: 'Larges' }
                  ].map(margin => (
                    <button
                      key={margin.id}
                      className={`option-btn ${currentLayout.pageMargins === margin.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('pageMargins', margin.id)}
                    >
                      {margin.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Options */}
          {activeTab === 'options' && (
            <div className="options-tab">
              <p className="tab-description">
                Configurez les options supplémentaires de vos devis.
              </p>

              <div className="option-row">
                <label className="option-label">
                  <input
                    type="checkbox"
                    checked={currentLayout.showLogo}
                    onChange={(e) => updateLayout('showLogo', e.target.checked)}
                  />
                  <span>Afficher le logo</span>
                </label>
                <span className="option-help">Votre logo apparaîtra en haut du devis</span>
              </div>

              <div className="option-row">
                <label className="option-label">
                  <input
                    type="checkbox"
                    checked={currentLayout.showSignatureZone}
                    onChange={(e) => updateLayout('showSignatureZone', e.target.checked)}
                  />
                  <span>Zone de signature client</span>
                </label>
                <span className="option-help">Ajoute un espace pour la signature en bas du devis</span>
              </div>

              <div className="option-section">
                <h4>Affichage des pièces jointes</h4>
                <div className="radio-group">
                  {[
                    { id: 'end', label: 'À la fin du devis', desc: 'Les images apparaissent après le contenu' },
                    { id: 'inline', label: 'Dans le corps', desc: 'Les images s\'intercalent avec le contenu' },
                    { id: 'separate', label: 'Pages séparées', desc: 'Chaque image sur une page distincte' }
                  ].map(opt => (
                    <label key={opt.id} className="radio-option">
                      <input
                        type="radio"
                        name="attachmentDisplay"
                        value={opt.id}
                        checked={currentLayout.attachmentDisplay === opt.id}
                        onChange={(e) => updateLayout('attachmentDisplay', e.target.value)}
                      />
                      <div>
                        <span className="radio-label">{opt.label}</span>
                        <span className="radio-desc">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="layout-editor-footer">
          <button
            className="btn btn-secondary"
            onClick={() => onLayoutChange?.(DEFAULT_LAYOUT)}
          >
            Réinitialiser
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuoteLayoutEditor;
