// src/utils/interventionTemplates.js
// Gestion des modèles d'interventions

import { safeStorage } from './safeStorage';

const STORAGE_KEY = 'intervention_templates';

/**
 * Get all saved templates
 */
export const getAllTemplates = () => {
  return safeStorage.getJSON(STORAGE_KEY, []);
};

/**
 * Save a new template
 */
export const saveTemplate = (template) => {
  const templates = getAllTemplates();
  const newTemplate = {
    id: `template-${Date.now()}`,
    ...template,
    createdAt: new Date().toISOString()
  };
  templates.push(newTemplate);
  safeStorage.setJSON(STORAGE_KEY, templates);
  return newTemplate;
};

/**
 * Delete a template
 */
export const deleteTemplate = (templateId) => {
  const templates = getAllTemplates();
  const updated = templates.filter(t => t.id !== templateId);
  safeStorage.setJSON(STORAGE_KEY, updated);
  return updated;
};

/**
 * Create intervention from template
 */
export const createFromTemplate = (template, overrides = {}) => {
  return {
    client: template.client || '',
    service: template.service || '',
    address: template.address || '',
    estimated_duration: template.estimated_duration || 2,
    type: template.type || '',
    notes: template.notes || '',
    ...overrides,
    id: `intervention-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
};

/**
 * Duplicate an existing intervention
 */
export const duplicateIntervention = (intervention, overrides = {}) => {
  const {
    id,
    created_at,
    updated_at,
    report,
    ...rest
  } = intervention;

  return {
    ...rest,
    ...overrides,
    id: `intervention-${Date.now()}`,
    status: 'planned',
    createdAt: new Date().toISOString()
  };
};

/**
 * Create template from intervention
 */
export const createTemplateFromIntervention = (intervention, templateName) => {
  const template = {
    name: templateName,
    client: intervention.client,
    service: intervention.service,
    address: intervention.address,
    estimated_duration: intervention.estimated_duration,
    type: intervention.type,
    notes: intervention.notes
  };

  return saveTemplate(template);
};
