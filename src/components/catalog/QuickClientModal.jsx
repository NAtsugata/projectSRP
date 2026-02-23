// =============================
// FILE: src/components/catalog/QuickClientModal.jsx
// Quick client creation modal for use within quote/invoice forms
// =============================
import React, { useState, useCallback } from 'react';
import { clientService } from '../../services/clientService';
import { withOrgId } from '../../utils/orgHelper';
import './QuickClientModal.css';

const INITIAL_CLIENT_FORM = {
  name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
  postal_code: '',
  city: '',
  country: 'France',
  siret: '',
  tva_number: '',
  client_type: 'company',
  payment_terms: 30
};

function QuickClientModal({ onClose, onClientCreated, showToast }) {
  const [form, setForm] = useState(INITIAL_CLIENT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!form.name) {
      showToast?.('Le nom est obligatoire', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await clientService.createClient(form);
      if (error) throw error;

      showToast?.('Client cree avec succes', 'success');
      onClientCreated?.(data);
      onClose?.();
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, onClose, onClientCreated, showToast]);

  return (
    <div className="quick-client-overlay" onClick={onClose}>
      <div className="quick-client-modal" onClick={e => e.stopPropagation()}>
        <div className="quick-client-header">
          <h2>Nouveau client rapide</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="quick-client-body">
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={form.client_type}
                  onChange={(e) => handleChange('client_type', e.target.value)}
                >
                  <option value="company">Entreprise</option>
                  <option value="individual">Particulier</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={form.client_type === 'company' ? 'Nom du contact' : 'Nom complet'}
                required
                autoFocus
              />
            </div>

            {form.client_type === 'company' && (
              <div className="form-group">
                <label>Raison sociale</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  placeholder="Nom de l'entreprise"
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="form-group">
                <label>Telephone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Adresse"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Code postal</label>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="75000"
                />
              </div>
              <div className="form-group">
                <label>Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Paris"
                />
              </div>
            </div>

            {form.client_type === 'company' && (
              <div className="form-row">
                <div className="form-group">
                  <label>SIRET</label>
                  <input
                    type="text"
                    value={form.siret}
                    onChange={(e) => handleChange('siret', e.target.value)}
                    placeholder="123 456 789 00012"
                  />
                </div>
                <div className="form-group">
                  <label>N° TVA</label>
                  <input
                    type="text"
                    value={form.tva_number}
                    onChange={(e) => handleChange('tva_number', e.target.value)}
                    placeholder="FR12345678901"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Delai de paiement (jours)</label>
              <input
                type="number"
                min="0"
                value={form.payment_terms}
                onChange={(e) => handleChange('payment_terms', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="quick-client-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creation...' : 'Creer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickClientModal;
