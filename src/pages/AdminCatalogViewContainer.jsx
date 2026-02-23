// =============================
// FILE: src/pages/AdminCatalogViewContainer.jsx
// Container for catalog management
// =============================
import React, { useState, useCallback } from 'react';
import {
  useCatalogItems,
  useCatalogCategories,
  useTaxRates,
  useQuoteTemplates,
  useCatalogStats
} from '../hooks/useCatalog';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../contexts/ToastContext';
import { catalogService } from '../services/catalogService';
import AdminCatalogView from './AdminCatalogView';

function AdminCatalogViewContainer() {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();

  // State
  const [activeTab, setActiveTab] = useState('items');

  // Hooks
  const {
    items,
    isLoading: isLoadingItems,
    error: itemsError,
    refetch: refetchItems,
    createItem,
    updateItem,
    deleteItem,
    toggleFavorite,
    isCreating: isCreatingItem,
    isUpdating: isUpdatingItem
  } = useCatalogItems();

  const {
    categories,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    isCreating: isCreatingCategory,
    isUpdating: isUpdatingCategory
  } = useCatalogCategories();

  const {
    taxRates,
    isLoading: isLoadingTaxRates,
    refetch: refetchTaxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
    setDefaultTaxRate,
    initializeDefaults: initializeTaxRates,
    isCreating: isCreatingTax,
    isUpdating: isUpdatingTax
  } = useTaxRates();

  const {
    templates,
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
    isCreating: isCreatingTemplate,
    isUpdating: isUpdatingTemplate
  } = useQuoteTemplates();

  const { data: stats } = useCatalogStats();

  // Handlers
  const handleRefresh = useCallback(() => {
    refetchItems();
    refetchCategories();
    refetchTaxRates();
    refetchTemplates();
  }, [refetchItems, refetchCategories, refetchTaxRates, refetchTemplates]);

  const handleExportCSV = useCallback(async () => {
    try {
      const { data, error } = await catalogService.exportCatalogCSV();
      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalogue_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Catalogue exporte', 'success');
    } catch (err) {
      showToast(`Erreur export: ${err.message}`, 'error');
    }
  }, [showToast]);

  const handleInitializeTaxRates = useCallback(async () => {
    try {
      await initializeTaxRates();
      showToast('Taux TVA initialises', 'success');
    } catch (err) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  }, [initializeTaxRates, showToast]);

  const handleDuplicateTemplate = useCallback(async ({ templateId, newName }) => {
    try {
      await duplicateTemplate({ templateId, newName });
      showToast('Modele duplique', 'success');
    } catch (err) {
      showToast(`Erreur: ${err.message}`, 'error');
    }
  }, [duplicateTemplate, showToast]);

  return (
    <AdminCatalogView
      items={items}
      categories={categories}
      taxRates={taxRates}
      templates={templates}
      stats={stats}
      activeTab={activeTab}
      isLoading={isLoadingItems || isLoadingCategories || isLoadingTaxRates || isLoadingTemplates}
      isCreating={isCreatingItem || isCreatingCategory || isCreatingTax || isCreatingTemplate}
      isUpdating={isUpdatingItem || isUpdatingCategory || isUpdatingTax || isUpdatingTemplate}
      isOnline={isOnline}
      error={itemsError}
      onTabChange={setActiveTab}
      // Items
      onCreateItem={createItem}
      onUpdateItem={updateItem}
      onDeleteItem={deleteItem}
      onToggleFavorite={toggleFavorite}
      onExportCSV={handleExportCSV}
      // Categories
      onCreateCategory={createCategory}
      onUpdateCategory={updateCategory}
      onDeleteCategory={deleteCategory}
      // Tax rates
      onCreateTaxRate={createTaxRate}
      onUpdateTaxRate={updateTaxRate}
      onDeleteTaxRate={deleteTaxRate}
      onSetDefaultTaxRate={setDefaultTaxRate}
      onInitializeTaxRates={handleInitializeTaxRates}
      // Templates
      onCreateTemplate={createTemplate}
      onUpdateTemplate={updateTemplate}
      onDeleteTemplate={deleteTemplate}
      onSetDefaultTemplate={setDefaultTemplate}
      onDuplicateTemplate={handleDuplicateTemplate}
      // General
      onRefresh={handleRefresh}
      showToast={showToast}
    />
  );
}

export default AdminCatalogViewContainer;
