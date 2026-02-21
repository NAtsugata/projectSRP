// =============================
// FILE: src/pages/AdminClientsViewContainer.jsx
// Container component for Admin Clients View (CRM)
// =============================
import React, { useState } from 'react';
import AdminClientsView from './AdminClientsView';
import { useClients, useClient, useClientStats, useClientInterventions } from '../hooks/useClients';
import { useToast } from '../contexts/ToastContext';

function AdminClientsViewContainer() {
  const { showToast } = useToast();

  // State pour les filtres
  const [filters, setFilters] = useState({
    searchTerm: '',
    clientType: null,
    city: null,
    isActive: true
  });

  // State pour le client selectionne (detail)
  const [selectedClientId, setSelectedClientId] = useState(null);

  // Query principale - liste des clients
  const {
    clients,
    isLoading,
    error,
    refetch,
    isOnline,
    // Mutations
    createClient,
    updateClient,
    deactivateClient,
    deleteClient,
    isCreating,
    isUpdating,
    // Contacts
    addContact,
    updateContact,
    deleteContact,
    // Utilitaires
    searchClients,
    exportCSV
  } = useClients(filters);

  // Query pour le client selectionne
  const {
    data: selectedClient,
    isLoading: isLoadingClient
  } = useClient(selectedClientId);

  // Stats du client selectionne
  const {
    data: clientStats
  } = useClientStats(selectedClientId);

  // Historique interventions du client selectionne
  const {
    data: clientInterventions
  } = useClientInterventions(selectedClientId);

  // Handlers
  const handleCreateClient = async (clientData, contacts) => {
    try {
      const result = await createClient({ clientData, contacts });
      if (result.error) throw result.error;
      showToast('Client cree avec succes', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la creation', 'error');
      throw error;
    }
  };

  const handleUpdateClient = async (clientId, updates) => {
    try {
      const result = await updateClient({ clientId, updates });
      if (result.error) throw result.error;
      showToast('Client mis a jour', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la mise a jour', 'error');
      throw error;
    }
  };

  const handleDeactivateClient = async (clientId) => {
    try {
      await deactivateClient(clientId);
      showToast('Client desactive', 'success');
    } catch (error) {
      showToast(error.message || 'Erreur lors de la desactivation', 'error');
      throw error;
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      await deleteClient(clientId);
      showToast('Client supprime', 'success');
      if (selectedClientId === clientId) {
        setSelectedClientId(null);
      }
    } catch (error) {
      showToast(error.message || 'Erreur lors de la suppression', 'error');
      throw error;
    }
  };

  const handleAddContact = async (clientId, contactData) => {
    try {
      const result = await addContact({ clientId, contactData });
      if (result.error) throw result.error;
      showToast('Contact ajoute', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de l\'ajout du contact', 'error');
      throw error;
    }
  };

  const handleUpdateContact = async (contactId, updates) => {
    try {
      const result = await updateContact({ contactId, updates });
      if (result.error) throw result.error;
      showToast('Contact mis a jour', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la mise a jour', 'error');
      throw error;
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await deleteContact(contactId);
      showToast('Contact supprime', 'success');
    } catch (error) {
      showToast(error.message || 'Erreur lors de la suppression', 'error');
      throw error;
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Export CSV telecharge', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'export', 'error');
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
  };

  return (
    <AdminClientsView
      // Donnees
      clients={clients}
      selectedClient={selectedClient}
      clientStats={clientStats}
      clientInterventions={clientInterventions}
      filters={filters}
      // Etats
      isLoading={isLoading}
      isLoadingClient={isLoadingClient}
      isCreating={isCreating}
      isUpdating={isUpdating}
      isOnline={isOnline}
      error={error}
      // Actions clients
      onCreateClient={handleCreateClient}
      onUpdateClient={handleUpdateClient}
      onDeactivateClient={handleDeactivateClient}
      onDeleteClient={handleDeleteClient}
      // Actions contacts
      onAddContact={handleAddContact}
      onUpdateContact={handleUpdateContact}
      onDeleteContact={handleDeleteContact}
      // Navigation
      onSelectClient={handleSelectClient}
      onFilterChange={handleFilterChange}
      onRefresh={refetch}
      onExportCSV={handleExportCSV}
      // Utilitaires
      searchClients={searchClients}
      showToast={showToast}
    />
  );
}

export default AdminClientsViewContainer;
