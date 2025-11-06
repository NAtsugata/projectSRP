// src/components/intervention/AssignChecklistButton.js
// Bouton pour assigner une checklist à une intervention (pour admin)
import React, { useState } from 'react';
import { CheckCircleIcon, PlusIcon, XIcon } from '../SharedUI';

export default function AssignChecklistButton({ intervention, templates = [], onAssignChecklist }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleAssign = async () => {
    if (!selectedTemplate) {
      alert('Veuillez sélectionner un template');
      return;
    }

    try {
      await onAssignChecklist(intervention.id, selectedTemplate);
      setShowModal(false);
      setSelectedTemplate('');
    } catch (error) {
      console.error('Erreur assignation checklist:', error);
      alert('Erreur lors de l\'assignation');
    }
  };

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setShowModal(true)}
        title="Assigner une checklist à cette intervention"
      >
        <CheckCircleIcon /> Checklist
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>📋 Assigner une Checklist</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Intervention:
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {intervention.title} - {intervention.client_name}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="template-select">
                Sélectionnez un template de checklist *
              </label>
              <select
                id="template-select"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="form-control"
              >
                <option value="">-- Choisir un template --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.items.length} items)
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div style={{ padding: '0.75rem', background: '#f0f9ff', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                  ℹ️ Cette checklist sera automatiquement assignée aux employés de cette intervention
                </div>
                {templates.find(t => t.id === selectedTemplate) && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    📋 {templates.find(t => t.id === selectedTemplate).items.length} items
                    {templates.find(t => t.id === selectedTemplate).items.filter(i => i.required).length > 0 && (
                      <span style={{ marginLeft: '0.5rem' }}>
                        • ⚠️ {templates.find(t => t.id === selectedTemplate).items.filter(i => i.required).length} obligatoires
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={!selectedTemplate}
                style={{ flex: 1 }}
              >
                <PlusIcon /> Assigner
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
