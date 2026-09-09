// =============================
// FILE: src/components/quotes/QuoteLayoutEditor.jsx
// Éditeur de mise en page avancé pour personnaliser les devis
// =============================
import React, { useState, useCallback, useMemo } from 'react';
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

// Palette de couleurs prédéfinies
const COLOR_PRESETS = [
  { id: 'blue', color: '#3b82f6', label: 'Bleu' },
  { id: 'purple', color: '#8b5cf6', label: 'Violet' },
  { id: 'green', color: '#059669', label: 'Vert' },
  { id: 'red', color: '#dc2626', label: 'Rouge' },
  { id: 'orange', color: '#ea580c', label: 'Orange' },
  { id: 'teal', color: '#0d9488', label: 'Turquoise' },
  { id: 'pink', color: '#db2777', label: 'Rose' },
  { id: 'indigo', color: '#4f46e5', label: 'Indigo' },
  { id: 'gray', color: '#6b7280', label: 'Gris' },
  { id: 'black', color: '#1f2937', label: 'Noir' },
];

// Couleurs de texte
const TEXT_COLOR_PRESETS = [
  { id: 'dark', color: '#1f2937', label: 'Foncé' },
  { id: 'medium', color: '#4b5563', label: 'Moyen' },
  { id: 'light', color: '#6b7280', label: 'Clair' },
  { id: 'navy', color: '#1e3a5f', label: 'Marine' },
  { id: 'brown', color: '#78350f', label: 'Marron' },
];

// Polices disponibles
const FONTS = [
  { id: 'helvetica', label: 'Helvetica', preview: 'Helvetica, Arial, sans-serif' },
  { id: 'times', label: 'Times', preview: 'Times New Roman, serif' },
  { id: 'courier', label: 'Courier', preview: 'Courier New, monospace' },
];

// Options de filigrane
const WATERMARK_PRESETS = [
  { id: 'none', label: 'Aucun' },
  { id: 'draft', label: 'BROUILLON' },
  { id: 'confidential', label: 'CONFIDENTIEL' },
  { id: 'copy', label: 'COPIE' },
  { id: 'sample', label: 'SPECIMEN' },
  { id: 'custom', label: 'Personnalisé' },
];

// Layout par défaut
export const DEFAULT_LAYOUT = {
  sections: DEFAULT_SECTIONS.map((s, i) => ({
    id: s.id,
    visible: s.id !== 'signature',
    order: i
  })),
  // Style de base
  theme: 'default',
  showLogo: true,
  showSignatureZone: false,
  attachmentDisplay: 'end',
  fontSize: 'medium',
  pageMargins: 'normal',

  // Couleurs personnalisées
  primaryColor: '#3b82f6',
  textColor: '#1f2937',
  headerTextColor: '#ffffff',
  tableBgColor: '#f8fafc',

  // Typographie
  fontFamily: 'helvetica',
  titleStyle: 'bold',

  // Logo
  logoPosition: 'left',
  logoSize: 'medium',

  // En-tête personnalisé
  customTitle: '',
  showQuoteNumber: true,

  // Filigrane
  watermark: 'none',
  customWatermark: '',
  watermarkOpacity: 0.1,

  // Style du tableau
  tableBorderStyle: 'simple',
  alternateRowColors: true,

  // Pied de page
  showPageNumbers: true,
  customFooter: '',

  // Titre du document
  documentTitle: 'DEVIS',
};

function QuoteLayoutEditor({
  layout = DEFAULT_LAYOUT,
  onLayoutChange,
  isOpen,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('sections');
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Fusionner avec les valeurs par défaut
  const currentLayout = useMemo(() => ({
    ...DEFAULT_LAYOUT,
    ...layout,
    sections: layout?.sections || DEFAULT_LAYOUT.sections
  }), [layout]);

  // Obtenir les sections triées par ordre
  const getSortedSections = useCallback(() => {
    return [...currentLayout.sections]
      .sort((a, b) => a.order - b.order)
      .map(section => ({
        ...section,
        ...DEFAULT_SECTIONS.find(s => s.id === section.id)
      }));
  }, [currentLayout.sections]);

  // Mettre à jour une valeur du layout
  const updateLayout = useCallback((key, value) => {
    onLayoutChange?.({
      ...currentLayout,
      [key]: value
    });
  }, [currentLayout, onLayoutChange]);

  // Mettre à jour plusieurs valeurs
  const updateLayoutMultiple = useCallback((updates) => {
    onLayoutChange?.({
      ...currentLayout,
      ...updates
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
      <div className="layout-editor layout-editor-large" onClick={(e) => e.stopPropagation()}>
        <div className="layout-editor-header">
          <h2>Personnaliser votre devis</h2>
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
            className={`tab ${activeTab === 'colors' ? 'active' : ''}`}
            onClick={() => setActiveTab('colors')}
          >
            Couleurs
          </button>
          <button
            className={`tab ${activeTab === 'typography' ? 'active' : ''}`}
            onClick={() => setActiveTab('typography')}
          >
            Typographie
          </button>
          <button
            className={`tab ${activeTab === 'header' ? 'active' : ''}`}
            onClick={() => setActiveTab('header')}
          >
            En-tête
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

          {/* Tab: Couleurs */}
          {activeTab === 'colors' && (
            <div className="colors-tab">
              <p className="tab-description">
                Personnalisez les couleurs de votre devis pour refléter votre identité visuelle.
              </p>

              {/* Couleur principale */}
              <div className="style-section">
                <h4>Couleur principale</h4>
                <p className="section-help">Utilisée pour les titres, les bordures et les accents</p>
                <div className="color-picker-row">
                  <div className="color-presets">
                    {COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        className={`color-preset ${currentLayout.primaryColor === preset.color ? 'selected' : ''}`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => updateLayout('primaryColor', preset.color)}
                        title={preset.label}
                      />
                    ))}
                  </div>
                  <div className="custom-color">
                    <input
                      type="color"
                      value={currentLayout.primaryColor}
                      onChange={(e) => updateLayout('primaryColor', e.target.value)}
                      className="color-input"
                    />
                    <span className="color-value">{currentLayout.primaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Couleur du texte */}
              <div className="style-section">
                <h4>Couleur du texte</h4>
                <p className="section-help">Couleur du texte principal du document</p>
                <div className="color-picker-row">
                  <div className="color-presets">
                    {TEXT_COLOR_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        className={`color-preset ${currentLayout.textColor === preset.color ? 'selected' : ''}`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => updateLayout('textColor', preset.color)}
                        title={preset.label}
                      />
                    ))}
                  </div>
                  <div className="custom-color">
                    <input
                      type="color"
                      value={currentLayout.textColor}
                      onChange={(e) => updateLayout('textColor', e.target.value)}
                      className="color-input"
                    />
                    <span className="color-value">{currentLayout.textColor}</span>
                  </div>
                </div>
              </div>

              {/* Couleur d'en-tête de tableau */}
              <div className="style-section">
                <h4>Texte des en-têtes</h4>
                <p className="section-help">Couleur du texte dans les en-têtes de tableau</p>
                <div className="color-picker-row">
                  <div className="color-presets">
                    <button
                      className={`color-preset ${currentLayout.headerTextColor === '#ffffff' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
                      onClick={() => updateLayout('headerTextColor', '#ffffff')}
                      title="Blanc"
                    />
                    <button
                      className={`color-preset ${currentLayout.headerTextColor === '#1f2937' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#1f2937' }}
                      onClick={() => updateLayout('headerTextColor', '#1f2937')}
                      title="Noir"
                    />
                  </div>
                  <div className="custom-color">
                    <input
                      type="color"
                      value={currentLayout.headerTextColor}
                      onChange={(e) => updateLayout('headerTextColor', e.target.value)}
                      className="color-input"
                    />
                  </div>
                </div>
              </div>

              {/* Couleur de fond alternée */}
              <div className="style-section">
                <h4>Fond des lignes alternées</h4>
                <p className="section-help">Couleur de fond pour les lignes paires du tableau</p>
                <div className="color-picker-row">
                  <div className="color-presets">
                    {[
                      { color: '#f8fafc', label: 'Gris clair' },
                      { color: '#f0f9ff', label: 'Bleu clair' },
                      { color: '#f0fdf4', label: 'Vert clair' },
                      { color: '#fefce8', label: 'Jaune clair' },
                      { color: '#ffffff', label: 'Blanc' },
                    ].map(preset => (
                      <button
                        key={preset.color}
                        className={`color-preset ${currentLayout.tableBgColor === preset.color ? 'selected' : ''}`}
                        style={{ backgroundColor: preset.color, border: '1px solid #e5e7eb' }}
                        onClick={() => updateLayout('tableBgColor', preset.color)}
                        title={preset.label}
                      />
                    ))}
                  </div>
                  <div className="custom-color">
                    <input
                      type="color"
                      value={currentLayout.tableBgColor}
                      onChange={(e) => updateLayout('tableBgColor', e.target.value)}
                      className="color-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Typographie */}
          {activeTab === 'typography' && (
            <div className="typography-tab">
              <p className="tab-description">
                Configurez la police et les styles de texte de votre devis.
              </p>

              {/* Police */}
              <div className="style-section">
                <h4>Police de caractères</h4>
                <div className="font-options">
                  {FONTS.map(font => (
                    <button
                      key={font.id}
                      className={`font-option ${currentLayout.fontFamily === font.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('fontFamily', font.id)}
                      style={{ fontFamily: font.preview }}
                    >
                      <span className="font-preview" style={{ fontFamily: font.preview }}>Aa</span>
                      <span className="font-label">{font.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Taille du texte */}
              <div className="style-section">
                <h4>Taille du texte</h4>
                <div className="button-group">
                  {[
                    { id: 'small', label: 'Petit', desc: 'Compact, plus de contenu par page' },
                    { id: 'medium', label: 'Moyen', desc: 'Taille standard, équilibré' },
                    { id: 'large', label: 'Grand', desc: 'Plus lisible, moins de contenu' }
                  ].map(size => (
                    <button
                      key={size.id}
                      className={`option-btn-large ${currentLayout.fontSize === size.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('fontSize', size.id)}
                    >
                      <span className="option-title">{size.label}</span>
                      <span className="option-desc">{size.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style du titre */}
              <div className="style-section">
                <h4>Style du titre</h4>
                <div className="button-group">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'bold', label: 'Gras' },
                    { id: 'italic', label: 'Italique' },
                    { id: 'uppercase', label: 'MAJUSCULES' }
                  ].map(style => (
                    <button
                      key={style.id}
                      className={`option-btn ${currentLayout.titleStyle === style.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('titleStyle', style.id)}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marges */}
              <div className="style-section">
                <h4>Marges de la page</h4>
                <div className="button-group">
                  {[
                    { id: 'narrow', label: 'Étroites', desc: '10mm' },
                    { id: 'normal', label: 'Normales', desc: '15mm' },
                    { id: 'wide', label: 'Larges', desc: '20mm' }
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

          {/* Tab: En-tête */}
          {activeTab === 'header' && (
            <div className="header-tab">
              <p className="tab-description">
                Personnalisez l'en-tête et l'apparence de votre devis.
              </p>

              {/* Titre du document */}
              <div className="style-section">
                <h4>Titre du document</h4>
                <input
                  type="text"
                  className="text-input"
                  placeholder="DEVIS"
                  value={currentLayout.documentTitle || ''}
                  onChange={(e) => updateLayout('documentTitle', e.target.value)}
                />
                <p className="section-help">Laissez vide pour utiliser "DEVIS" par défaut</p>
              </div>

              {/* Afficher le logo */}
              <div className="style-section">
                <h4>Logo</h4>
                <div className="option-row inline">
                  <label className="option-label">
                    <input
                      type="checkbox"
                      checked={currentLayout.showLogo}
                      onChange={(e) => updateLayout('showLogo', e.target.checked)}
                    />
                    <span>Afficher le logo</span>
                  </label>
                </div>

                {currentLayout.showLogo && (
                  <>
                    <div className="sub-option">
                      <span className="sub-label">Position du logo</span>
                      <div className="button-group">
                        {[
                          { id: 'left', label: 'Gauche' },
                          { id: 'center', label: 'Centre' },
                          { id: 'right', label: 'Droite' }
                        ].map(pos => (
                          <button
                            key={pos.id}
                            className={`option-btn-small ${currentLayout.logoPosition === pos.id ? 'selected' : ''}`}
                            onClick={() => updateLayout('logoPosition', pos.id)}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sub-option">
                      <span className="sub-label">Taille du logo</span>
                      <div className="button-group">
                        {[
                          { id: 'small', label: 'Petit', width: '30mm' },
                          { id: 'medium', label: 'Moyen', width: '50mm' },
                          { id: 'large', label: 'Grand', width: '70mm' }
                        ].map(size => (
                          <button
                            key={size.id}
                            className={`option-btn-small ${currentLayout.logoSize === size.id ? 'selected' : ''}`}
                            onClick={() => updateLayout('logoSize', size.id)}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Numéro de devis */}
              <div className="style-section">
                <h4>Numéro de référence</h4>
                <div className="option-row inline">
                  <label className="option-label">
                    <input
                      type="checkbox"
                      checked={currentLayout.showQuoteNumber}
                      onChange={(e) => updateLayout('showQuoteNumber', e.target.checked)}
                    />
                    <span>Afficher le numéro de devis</span>
                  </label>
                </div>
              </div>

              {/* Filigrane */}
              <div className="style-section">
                <h4>Filigrane</h4>
                <p className="section-help">Ajoutez un texte en filigrane sur le document</p>
                <div className="watermark-options">
                  {WATERMARK_PRESETS.map(wm => (
                    <button
                      key={wm.id}
                      className={`watermark-btn ${currentLayout.watermark === wm.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('watermark', wm.id)}
                    >
                      {wm.label}
                    </button>
                  ))}
                </div>

                {currentLayout.watermark === 'custom' && (
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Texte du filigrane..."
                    value={currentLayout.customWatermark || ''}
                    onChange={(e) => updateLayout('customWatermark', e.target.value)}
                  />
                )}

                {currentLayout.watermark !== 'none' && (
                  <div className="sub-option">
                    <span className="sub-label">Opacité: {Math.round(currentLayout.watermarkOpacity * 100)}%</span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.3"
                      step="0.05"
                      value={currentLayout.watermarkOpacity}
                      onChange={(e) => updateLayout('watermarkOpacity', parseFloat(e.target.value))}
                      className="range-input"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Options */}
          {activeTab === 'options' && (
            <div className="options-tab">
              <p className="tab-description">
                Configurez les options supplémentaires de vos devis.
              </p>

              {/* Style du tableau */}
              <div className="style-section">
                <h4>Style du tableau</h4>
                <div className="button-group">
                  {[
                    { id: 'none', label: 'Sans bordure', desc: 'Minimaliste' },
                    { id: 'simple', label: 'Simple', desc: 'Lignes horizontales' },
                    { id: 'full', label: 'Complet', desc: 'Toutes les bordures' }
                  ].map(style => (
                    <button
                      key={style.id}
                      className={`option-btn-large ${currentLayout.tableBorderStyle === style.id ? 'selected' : ''}`}
                      onClick={() => updateLayout('tableBorderStyle', style.id)}
                    >
                      <span className="option-title">{style.label}</span>
                      <span className="option-desc">{style.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="option-row inline">
                  <label className="option-label">
                    <input
                      type="checkbox"
                      checked={currentLayout.alternateRowColors}
                      onChange={(e) => updateLayout('alternateRowColors', e.target.checked)}
                    />
                    <span>Alterner les couleurs des lignes</span>
                  </label>
                </div>
              </div>

              {/* Zone de signature */}
              <div className="style-section">
                <h4>Zone de signature</h4>
                <div className="option-row inline">
                  <label className="option-label">
                    <input
                      type="checkbox"
                      checked={currentLayout.showSignatureZone}
                      onChange={(e) => updateLayout('showSignatureZone', e.target.checked)}
                    />
                    <span>Afficher une zone de signature client</span>
                  </label>
                </div>
                <p className="section-help">Ajoute un espace "Bon pour accord" en bas du devis</p>
              </div>

              {/* Pièces jointes */}
              <div className="style-section">
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

              {/* Pied de page */}
              <div className="style-section">
                <h4>Pied de page</h4>
                <div className="option-row inline">
                  <label className="option-label">
                    <input
                      type="checkbox"
                      checked={currentLayout.showPageNumbers}
                      onChange={(e) => updateLayout('showPageNumbers', e.target.checked)}
                    />
                    <span>Afficher la numérotation des pages</span>
                  </label>
                </div>

                <div className="sub-option">
                  <span className="sub-label">Texte personnalisé en pied de page</span>
                  <textarea
                    className="text-input textarea"
                    placeholder="Texte supplémentaire pour le pied de page..."
                    value={currentLayout.customFooter || ''}
                    onChange={(e) => updateLayout('customFooter', e.target.value)}
                    rows={2}
                  />
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
