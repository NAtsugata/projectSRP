// =============================
// FILE: src/pages/AdminClientsView.jsx
// Admin view for managing clients (CRM)
// =============================
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner, SkeletonList } from '../components/ui';
import { ConfirmationModal } from '../components/SharedUI';
import './AdminClientsView.css';

// Type de client
const CLIENT_TYPES = {
  standard: 'Standard',
  vip: 'VIP',
  prospect: 'Prospect'
};

// Formulaire initial
const INITIAL_FORM = {
  name: '',
  company_name: '',
  client_type: 'standard',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  address_complement: '',
  postal_code: '',
  city: '',
  country: 'France',
  siret: '',
  tva_number: '',
  payment_terms: 30,
  notes: '',
  tags: []
};

const INITIAL_CONTACT = {
  first_name: '',
  last_name: '',
  role: '',
  email: '',
  phone: '',
  mobile: '',
  is_primary: false,
  receives_invoices: false,
  receives_reports: false,
  notes: ''
};

function AdminClientsView({
  clients = [],
  selectedClient = null,
  clientStats = null,
  clientInterventions = [],
  filters = {},
  isLoading,
  isLoadingClient,
  isCreating,
  isUpdating,
  isOnline,
  error,
  onCreateClient,
  onUpdateClient,
  onDeactivateClient,
  onDeleteClient,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onSelectClient,
  onFilterChange,
  onRefresh,
  onExportCSV,
  searchClients,
  showToast
}) {
  const navigate = useNavigate();

  // States
  const [showModal, setShowModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [contactForm, setContactForm] = useState(INITIAL_CONTACT);
  const [localSearch, setLocalSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, clientId: null, clientName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrage local
  const filteredClients = useMemo(() => {
    let result = clients;

    if (localSearch) {
      const term = localSearch.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.company_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.city?.toLowerCase().includes(term)
      );
    }

    if (selectedType) {
      result = result.filter(c => c.client_type === selectedType);
    }

    return result;
  }, [clients, localSearch, selectedType]);

  // Stats locales
  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter(c => c.is_active).length,
    vip: clients.filter(c => c.client_type === 'vip').length,
    prospects: clients.filter(c => c.client_type === 'prospect').length
  }), [clients]);

  // Ouvrir modale nouveau client
  const handleNewClient = useCallback(() => {
    setEditingClient(null);
    setFormData(INITIAL_FORM);
    setShowModal(true);
  }, []);

  // Ouvrir modale edition
  const handleEditClient = useCallback((client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      company_name: client.company_name || '',
      client_type: client.client_type || 'standard',
      email: client.email || '',
      phone: client.phone || '',
      mobile: client.mobile || '',
      address: client.address || '',
      address_complement: client.address_complement || '',
      postal_code: client.postal_code || '',
      city: client.city || '',
      country: client.country || 'France',
      siret: client.siret || '',
      tva_number: client.tva_number || '',
      payment_terms: client.payment_terms || 30,
      notes: client.notes || '',
      tags: client.tags || []
    });
    setShowModal(true);
  }, []);

  // Voir detail client
  const handleViewClient = useCallback((clientId) => {
    onSelectClient(clientId);
    setShowDetailPanel(true);
  }, [onSelectClient]);

  // Soumettre formulaire client
  const handleSubmitClient = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Le nom du client est obligatoire', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingClient) {
        await onUpdateClient(editingClient.id, formData);
      } else {
        await onCreateClient(formData, []);
      }
      setShowModal(false);
      setEditingClient(null);
      setFormData(INITIAL_FORM);
    } catch (error) {
      // Toast deja affiche par le container
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nouveau contact
  const handleNewContact = useCallback(() => {
    if (!selectedClient) return;
    setEditingContact(null);
    setContactForm(INITIAL_CONTACT);
    setShowContactModal(true);
  }, [selectedClient]);

  // Editer contact
  const handleEditContact = useCallback((contact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      is_primary: contact.is_primary || false,
      receives_invoices: contact.receives_invoices || false,
      receives_reports: contact.receives_reports || false,
      notes: contact.notes || ''
    });
    setShowContactModal(true);
  }, []);

  // Soumettre contact
  const handleSubmitContact = async (e) => {
    e.preventDefault();

    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      showToast('Le nom et prenom sont obligatoires', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingContact) {
        await onUpdateContact(editingContact.id, contactForm);
      } else {
        await onAddContact(selectedClient.id, contactForm);
      }
      setShowContactModal(false);
      setEditingContact(null);
      setContactForm(INITIAL_CONTACT);
    } catch (error) {
      // Toast deja affiche
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmer suppression
  const handleConfirmDelete = useCallback((client) => {
    setDeleteConfirm({
      show: true,
      clientId: client.id,
      clientName: client.name
    });
  }, []);

  // Executer suppression
  const handleDelete = async () => {
    if (!deleteConfirm.clientId) return;
    try {
      await onDeleteClient(deleteConfirm.clientId);
      setDeleteConfirm({ show: false, clientId: null, clientName: '' });
    } catch (error) {
      // Toast deja affiche
    }
  };

  // Changer filtre type
  const handleTypeChange = (type) => {
    setSelectedType(type);
  };

  // Toggle clients inactifs
  const handleToggleInactive = () => {
    const newValue = !showInactive;
    setShowInactive(newValue);
    onFilterChange({ isActive: newValue ? null : true });
  };

  // Aller a l'intervention
  const handleGoToIntervention = (interventionId) => {
    navigate(`/planning/${interventionId}`);
  };

  // Creer intervention pour ce client
  const handleCreateInterventionForClient = () => {
    if (!selectedClient) return;
    navigate('/planning', {
      state: {
        prefillClient: {
          client_id: selectedClient.id,
          client: selectedClient.name,
          address: [selectedClient.address, selectedClient.postal_code, selectedClient.city].filter(Boolean).join(', '),
          client_phone: selectedClient.phone || selectedClient.mobile || '',
          client_email: selectedClient.email || ''
        }
      }
    });
  };

  // Render loading
  if (isLoading && clients.length === 0) {
    return (
      <div className="admin-clients-view">
        <div className="clients-header">
          <h1>Gestion des Clients</h1>
        </div>
        <SkeletonList count={5} variant="card" />
      </div>
    );
  }

  // Render error
  if (error) {
    return (
      <div className="admin-clients-view">
        <div className="clients-header">
          <h1>Gestion des Clients</h1>
        </div>
        <div className="error-state">
          <p>Erreur lors du chargement des clients</p>
          <button onClick={onRefresh} className="btn-retry">
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-clients-view">
      {/* Header */}
      <div className="clients-header">
        <div className="header-left">
          <h1>Gestion des Clients</h1>
          {!isOnline && <span className="offline-badge">Hors ligne</span>}
        </div>
        <div className="header-actions">
          <button onClick={onExportCSV} className="btn-export" title="Exporter en CSV">
            Exporter
          </button>
          <button onClick={handleNewClient} className="btn-primary" disabled={!isOnline}>
            + Nouveau client
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="clients-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">Actifs</span>
        </div>
        <div className="stat-card stat-vip">
          <span className="stat-value">{stats.vip}</span>
          <span className="stat-label">VIP</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.prospects}</span>
          <span className="stat-label">Prospects</span>
        </div>
      </div>

      {/* Filtres */}
      <div className="clients-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${selectedType === '' ? 'active' : ''}`}
            onClick={() => handleTypeChange('')}
          >
            Tous
          </button>
          {Object.entries(CLIENT_TYPES).map(([key, label]) => (
            <button
              key={key}
              className={`filter-btn ${selectedType === key ? 'active' : ''}`}
              onClick={() => handleTypeChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="show-inactive-toggle">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={handleToggleInactive}
          />
          Afficher inactifs
        </label>
      </div>

      {/* Liste des clients */}
      <div className={`clients-layout ${showDetailPanel ? 'with-panel' : ''}`}>
        <div className="clients-list">
          {filteredClients.length === 0 ? (
            <div className="empty-state">
              <p>Aucun client trouve</p>
              {localSearch && (
                <button onClick={() => setLocalSearch('')} className="btn-link">
                  Effacer la recherche
                </button>
              )}
            </div>
          ) : (
            filteredClients.map(client => (
              <div
                key={client.id}
                className={`client-card ${selectedClient?.id === client.id ? 'selected' : ''} ${!client.is_active ? 'inactive' : ''}`}
                onClick={() => handleViewClient(client.id)}
              >
                <div className="client-card-header">
                  <div className="client-info">
                    <h3 className="client-name">{client.name}</h3>
                    {client.company_name && (
                      <span className="company-name">{client.company_name}</span>
                    )}
                  </div>
                  <span className={`client-type type-${client.client_type}`}>
                    {CLIENT_TYPES[client.client_type] || client.client_type}
                  </span>
                </div>
                <div className="client-card-body">
                  {client.email && (
                    <div className="client-detail">
                      <span className="detail-icon">@</span>
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="client-detail">
                      <span className="detail-icon">T</span>
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.city && (
                    <div className="client-detail">
                      <span className="detail-icon">L</span>
                      <span>{client.city}</span>
                    </div>
                  )}
                </div>
                <div className="client-card-actions" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleEditClient(client)} className="btn-icon" title="Modifier">
                    E
                  </button>
                  <button onClick={() => handleConfirmDelete(client)} className="btn-icon btn-danger" title="Supprimer">
                    X
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel de detail */}
        {showDetailPanel && selectedClient && (
          <div className="client-detail-panel">
            <div className="panel-header">
              <h2>{selectedClient.name}</h2>
              <button onClick={() => setShowDetailPanel(false)} className="btn-close">X</button>
            </div>

            {isLoadingClient ? (
              <LoadingSpinner />
            ) : (
              <>
                {/* Infos client */}
                <div className="panel-section">
                  <h3>Informations</h3>
                  <div className="info-grid">
                    {selectedClient.company_name && (
                      <div className="info-item">
                        <label>Societe</label>
                        <span>{selectedClient.company_name}</span>
                      </div>
                    )}
                    <div className="info-item">
                      <label>Type</label>
                      <span className={`type-badge type-${selectedClient.client_type}`}>
                        {CLIENT_TYPES[selectedClient.client_type]}
                      </span>
                    </div>
                    {selectedClient.email && (
                      <div className="info-item">
                        <label>Email</label>
                        <a href={`mailto:${selectedClient.email}`}>{selectedClient.email}</a>
                      </div>
                    )}
                    {selectedClient.phone && (
                      <div className="info-item">
                        <label>Telephone</label>
                        <a href={`tel:${selectedClient.phone}`}>{selectedClient.phone}</a>
                      </div>
                    )}
                    {selectedClient.address && (
                      <div className="info-item full-width">
                        <label>Adresse</label>
                        <span>
                          {selectedClient.address}
                          {selectedClient.address_complement && <br />}
                          {selectedClient.address_complement}
                          <br />
                          {selectedClient.postal_code} {selectedClient.city}
                        </span>
                      </div>
                    )}
                    {selectedClient.siret && (
                      <div className="info-item">
                        <label>SIRET</label>
                        <span>{selectedClient.siret}</span>
                      </div>
                    )}
                    {selectedClient.payment_terms && (
                      <div className="info-item">
                        <label>Delai paiement</label>
                        <span>{selectedClient.payment_terms} jours</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEditClient(selectedClient)} className="btn-secondary">
                    Modifier
                  </button>
                </div>

                {/* Stats client */}
                {clientStats && (
                  <div className="panel-section">
                    <h3>Statistiques</h3>
                    <div className="stats-grid">
                      <div className="mini-stat">
                        <span className="mini-stat-value">{clientStats.totalInterventions}</span>
                        <span className="mini-stat-label">Interventions</span>
                      </div>
                      <div className="mini-stat">
                        <span className="mini-stat-value">{clientStats.completedInterventions}</span>
                        <span className="mini-stat-label">Terminees</span>
                      </div>
                      <div className="mini-stat">
                        <span className="mini-stat-value">{clientStats.activeContracts}</span>
                        <span className="mini-stat-label">Contrats</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contacts */}
                <div className="panel-section">
                  <div className="section-header">
                    <h3>Contacts</h3>
                    <button onClick={handleNewContact} className="btn-small">+ Ajouter</button>
                  </div>
                  {selectedClient.client_contacts?.length > 0 ? (
                    <div className="contacts-list">
                      {selectedClient.client_contacts.map(contact => (
                        <div key={contact.id} className="contact-item">
                          <div className="contact-info">
                            <span className="contact-name">
                              {contact.first_name} {contact.last_name}
                              {contact.is_primary && <span className="primary-badge">Principal</span>}
                            </span>
                            {contact.role && <span className="contact-role">{contact.role}</span>}
                            {contact.email && <span className="contact-email">{contact.email}</span>}
                            {contact.phone && <span className="contact-phone">{contact.phone}</span>}
                          </div>
                          <div className="contact-actions">
                            <button onClick={() => handleEditContact(contact)} className="btn-icon">E</button>
                            <button onClick={() => onDeleteContact(contact.id)} className="btn-icon btn-danger">X</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-contacts">Aucun contact</p>
                  )}
                </div>

                {/* Historique interventions */}
                <div className="panel-section">
                  <div className="section-header">
                    <h3>Historique interventions</h3>
                    <button onClick={handleCreateInterventionForClient} className="btn-small">
                      + Nouvelle intervention
                    </button>
                  </div>
                  {clientInterventions?.length > 0 ? (
                    <div className="interventions-list">
                      {clientInterventions.slice(0, 10).map(intervention => (
                        <div
                          key={intervention.id}
                          className="intervention-item"
                          onClick={() => handleGoToIntervention(intervention.id)}
                        >
                          <div className="intervention-info">
                            <span className="intervention-title">{intervention.title}</span>
                            <span className="intervention-date">
                              {new Date(intervention.scheduled_dates?.[0] || intervention.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <span className={`status-badge status-${intervention.status}`}>
                            {intervention.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-interventions">Aucune intervention</p>
                  )}
                </div>

                {/* Notes */}
                {selectedClient.notes && (
                  <div className="panel-section">
                    <h3>Notes</h3>
                    <p className="client-notes">{selectedClient.notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal client */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content client-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClient ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">X</button>
            </div>
            <form onSubmit={handleSubmitClient} className="client-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Nom *</label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="company_name">Societe</label>
                  <input
                    id="company_name"
                    type="text"
                    value={formData.company_name}
                    onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="client_type">Type</label>
                  <select
                    id="client_type"
                    value={formData.client_type}
                    onChange={e => setFormData(prev => ({ ...prev, client_type: e.target.value }))}
                  >
                    {Object.entries(CLIENT_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="payment_terms">Delai paiement (jours)</label>
                  <input
                    id="payment_terms"
                    type="number"
                    value={formData.payment_terms}
                    onChange={e => setFormData(prev => ({ ...prev, payment_terms: parseInt(e.target.value) || 30 }))}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-section-title">Contact</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Telephone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-section-title">Adresse</div>
              <div className="form-group">
                <label htmlFor="address">Adresse</label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="postal_code">Code postal</label>
                  <input
                    id="postal_code"
                    type="text"
                    value={formData.postal_code}
                    onChange={e => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="city">Ville</label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-section-title">Informations legales</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="siret">SIRET</label>
                  <input
                    id="siret"
                    type="text"
                    value={formData.siret}
                    onChange={e => setFormData(prev => ({ ...prev, siret: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tva_number">N TVA</label>
                  <input
                    id="tva_number"
                    type="text"
                    value={formData.tva_number}
                    onChange={e => setFormData(prev => ({ ...prev, tva_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : (editingClient ? 'Mettre a jour' : 'Creer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal contact */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content contact-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</h2>
              <button onClick={() => setShowContactModal(false)} className="btn-close">X</button>
            </div>
            <form onSubmit={handleSubmitContact}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="first_name">Prenom *</label>
                  <input
                    id="first_name"
                    type="text"
                    value={contactForm.first_name}
                    onChange={e => setContactForm(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="last_name">Nom *</label>
                  <input
                    id="last_name"
                    type="text"
                    value={contactForm.last_name}
                    onChange={e => setContactForm(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="role">Fonction</label>
                <input
                  id="role"
                  type="text"
                  value={contactForm.role}
                  onChange={e => setContactForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Ex: Responsable technique"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contact_email">Email</label>
                  <input
                    id="contact_email"
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contact_phone">Telephone</label>
                  <input
                    id="contact_phone"
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-checkboxes">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={contactForm.is_primary}
                    onChange={e => setContactForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                  />
                  Contact principal
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={contactForm.receives_invoices}
                    onChange={e => setContactForm(prev => ({ ...prev, receives_invoices: e.target.checked }))}
                  />
                  Recoit les factures
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={contactForm.receives_reports}
                    onChange={e => setContactForm(prev => ({ ...prev, receives_reports: e.target.checked }))}
                  />
                  Recoit les rapports
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowContactModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : (editingContact ? 'Mettre a jour' : 'Ajouter')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {deleteConfirm.show && (
        <ConfirmationModal
          title="Supprimer le client"
          message={`Etes-vous sur de vouloir supprimer le client "${deleteConfirm.clientName}" ? Cette action est irreversible.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ show: false, clientId: null, clientName: '' })}
        />
      )}
    </div>
  );
}

export default AdminClientsView;
