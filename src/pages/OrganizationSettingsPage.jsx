// =============================
// FILE: src/pages/OrganizationSettingsPage.jsx
// Page de paramètres de l'organisation (logo, conditions, facturation)
// =============================
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import { safeStorage } from '../utils/safeStorage';
import './OrganizationSettingsPage.css';

const DEFAULT_INVOICE_SETTINGS = {
  default_terms: "Conditions de règlement : 30 jours fin de mois.\nTout retard de paiement entraînera des pénalités de retard.",
  default_footer: "",
  default_payment_terms: 30,
  default_tax_rate: 20,
  quote_validity_days: 30,
  show_logo_on_documents: true,
  show_siret: true,
  bank_details: {
    iban: "",
    bic: "",
    bank_name: ""
  },
  legal_mentions: ""
};

function OrganizationSettingsPage() {
  const { profile } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');
  const [formData, setFormData] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sync offline state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, label: '' });
  const [syncStats, setSyncStats] = useState(null);

  const organizationId = profile?.organization_id;

  // Fetch organization data
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });

  // Initialize form data when organization loads
  useEffect(() => {
    if (organization) {
      const invoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, ...(organization.invoice_settings || {}) };
      setFormData({
        // Company info
        name: organization.name || '',
        address: organization.address || '',
        phone: organization.phone || '',
        email: organization.email || '',
        siret: organization.siret || '',
        vat_number: organization.vat_number || '',
        ape_code: organization.ape_code || '',
        share_capital: organization.share_capital || '',
        legal_form: organization.legal_form || '',
        rcs: organization.rcs || '',
        // Logo
        logo_url: organization.logo_url || '',
        // Invoice settings
        ...invoiceSettings,
        // Bank details (flatten for form)
        iban: invoiceSettings.bank_details?.iban || '',
        bic: invoiceSettings.bank_details?.bic || '',
        bank_name: invoiceSettings.bank_details?.bank_name || ''
      });
      setLogoPreview(organization.logo_url);
    }
  }, [organization]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updates) => {
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Paramètres enregistrés');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle logo file selection
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 2MB)');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload logo
  const uploadLogo = async () => {
    if (!logoFile) return formData.logo_url || '';

    setIsUploading(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${organizationId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        // Si le bucket n'existe pas, on ignore l'erreur du logo
        console.error('Upload error:', uploadError);
        toast.error(`Erreur upload logo: ${uploadError.message}`);
        return formData.logo_url || '';
      }

      const { data } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      return data?.publicUrl || '';
    } catch (error) {
      console.error('Upload exception:', error);
      toast.error(`Erreur upload logo: ${error.message}`);
      return formData.logo_url || '';
    } finally {
      setIsUploading(false);
    }
  };

  // Save company info
  const saveCompanyInfo = async () => {
    try {
      const logoUrl = await uploadLogo();

      // Récupérer les paramètres de facturation existants pour mettre à jour show_logo_on_documents
      const currentInvoiceSettings = organization?.invoice_settings || {};
      const updatedInvoiceSettings = {
        ...currentInvoiceSettings,
        show_logo_on_documents: formData.show_logo_on_documents ?? true
      };

      const updates = {
        name: formData.name || '',
        address: formData.address || '',
        phone: formData.phone || '',
        email: formData.email || '',
        siret: formData.siret || '',
        vat_number: formData.vat_number || null,
        ape_code: formData.ape_code || null,
        share_capital: formData.share_capital || null,
        legal_form: formData.legal_form || null,
        rcs: formData.rcs || null,
        logo_url: logoUrl || null,
        invoice_settings: updatedInvoiceSettings,
        updated_at: new Date().toISOString()
      };

      await saveMutation.mutateAsync(updates);
      setLogoFile(null);

      // Synchroniser vers le localStorage CERFA pour que les formulaires lisent les bonnes infos
      const existing = safeStorage.getJSON('cerfa_company_info', {});
      safeStorage.setJSON('cerfa_company_info', {
        ...existing,
        companyName: updates.name || existing.companyName || '',
        siret:       updates.siret   || existing.siret   || '',
        address:     updates.address || existing.address || '',
        phone:       updates.phone   || existing.phone   || '',
        email:       updates.email   || existing.email   || '',
      });
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  // Save invoice settings
  const saveInvoiceSettings = async () => {
    try {
      const invoiceSettings = {
        default_terms: formData.default_terms || '',
        default_footer: formData.default_footer || '',
        default_payment_terms: parseInt(formData.default_payment_terms) || 30,
        default_tax_rate: parseFloat(formData.default_tax_rate) || 20,
        quote_validity_days: parseInt(formData.quote_validity_days) || 30,
        show_logo_on_documents: formData.show_logo_on_documents ?? true,
        show_siret: formData.show_siret ?? true,
        bank_details: {
          iban: formData.iban || '',
          bic: formData.bic || '',
          bank_name: formData.bank_name || ''
        },
        legal_mentions: formData.legal_mentions || ''
      };

      await saveMutation.mutateAsync({
        invoice_settings: invoiceSettings,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Save invoice settings error:', error);
    }
  };

  // Synchroniser les données pour le mode hors ligne
  const handleSyncOfflineData = async () => {
    if (!profile?.id) {
      toast.error('Impossible de synchroniser : profil non chargé');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: 5, label: 'Démarrage...' });
    setSyncStats(null);

    try {
      const { syncOfflineData } = await import('../services/offlineAuthService');

      const result = await syncOfflineData(
        supabase,
        profile.id,
        (current, total, label) => {
          setSyncProgress({ current, total, label });
        }
      );

      if (result.success) {
        setSyncStats(result.stats);
        toast.success('✅ Synchronisation terminée ! Vous pouvez maintenant utiliser l\'app hors ligne.');
      } else {
        toast.error(`Erreur de synchronisation : ${result.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(`Erreur : ${error.message}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, label: '' });
    }
  };

  // Remove logo
  const removeLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo_url: '' }));
  }, []);

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="organization-settings-page">
      <header className="settings-header">
        <h1>Paramètres de l'organisation</h1>
        <p>Configurez les informations de votre entreprise et les paramètres de facturation</p>
      </header>

      <div className="settings-tabs">
        <button
          className={`tab-btn ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          Informations entreprise
        </button>
        <button
          className={`tab-btn ${activeTab === 'logo' ? 'active' : ''}`}
          onClick={() => setActiveTab('logo')}
        >
          Logo
        </button>
        <button
          className={`tab-btn ${activeTab === 'invoicing' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoicing')}
        >
          Facturation
        </button>
        <button
          className={`tab-btn ${activeTab === 'bank' ? 'active' : ''}`}
          onClick={() => setActiveTab('bank')}
        >
          Coordonnées bancaires
        </button>
        <button
          className={`tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
          onClick={() => setActiveTab('offline')}
        >
          📴 Mode hors ligne
        </button>
      </div>

      <div className="settings-content">
        {/* TAB: Company Info */}
        {activeTab === 'company' && (
          <div className="settings-section">
            <h2>Informations de l'entreprise</h2>
            <p className="section-desc">Ces informations apparaîtront sur vos devis et factures</p>

            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="name">Nom de l'entreprise *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  placeholder="Nom de votre entreprise"
                />
              </div>

              <div className="form-group">
                <label htmlFor="legal_form">Forme juridique</label>
                <select
                  id="legal_form"
                  name="legal_form"
                  value={formData.legal_form || ''}
                  onChange={handleChange}
                >
                  <option value="">Sélectionner...</option>
                  <option value="EI">Entreprise Individuelle (EI)</option>
                  <option value="EIRL">EIRL</option>
                  <option value="EURL">EURL</option>
                  <option value="SARL">SARL</option>
                  <option value="SAS">SAS</option>
                  <option value="SASU">SASU</option>
                  <option value="SA">SA</option>
                  <option value="SNC">SNC</option>
                  <option value="Auto-entrepreneur">Auto-entrepreneur</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="share_capital">Capital social</label>
                <input
                  type="text"
                  id="share_capital"
                  name="share_capital"
                  value={formData.share_capital || ''}
                  onChange={handleChange}
                  placeholder="ex: 10 000 €"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="address">Adresse complète</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Numéro, rue&#10;Code postal Ville"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Téléphone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="01 23 45 67 89"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="contact@entreprise.fr"
                />
              </div>

              <div className="form-group">
                <label htmlFor="siret">SIRET</label>
                <input
                  type="text"
                  id="siret"
                  name="siret"
                  value={formData.siret || ''}
                  onChange={handleChange}
                  placeholder="123 456 789 00012"
                  maxLength={17}
                />
              </div>

              <div className="form-group">
                <label htmlFor="vat_number">N° TVA Intracommunautaire</label>
                <input
                  type="text"
                  id="vat_number"
                  name="vat_number"
                  value={formData.vat_number || ''}
                  onChange={handleChange}
                  placeholder="FR12345678901"
                />
              </div>

              <div className="form-group">
                <label htmlFor="ape_code">Code APE/NAF</label>
                <input
                  type="text"
                  id="ape_code"
                  name="ape_code"
                  value={formData.ape_code || ''}
                  onChange={handleChange}
                  placeholder="4322A"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rcs">RCS</label>
                <input
                  type="text"
                  id="rcs"
                  name="rcs"
                  value={formData.rcs || ''}
                  onChange={handleChange}
                  placeholder="RCS Paris B 123 456 789"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn-save"
                onClick={saveCompanyInfo}
                disabled={saveMutation.isPending || isUploading}
              >
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Logo */}
        {activeTab === 'logo' && (
          <div className="settings-section">
            <h2>Logo de l'entreprise</h2>
            <p className="section-desc">Ce logo apparaîtra sur vos documents (devis, factures)</p>

            <div className="logo-section">
              <div className="logo-preview-container">
                {logoPreview ? (
                  <div className="logo-preview">
                    <img src={logoPreview} alt="Logo de l'entreprise" />
                    <button className="btn-remove-logo" onClick={removeLogo}>
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <div className="logo-placeholder">
                    <span>Aucun logo</span>
                  </div>
                )}
              </div>

              <div className="logo-upload">
                <label htmlFor="logo-input" className="btn-upload">
                  {logoPreview ? 'Changer le logo' : 'Ajouter un logo'}
                </label>
                <input
                  type="file"
                  id="logo-input"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoChange}
                  style={{ display: 'none' }}
                />
                <p className="upload-hint">
                  Formats acceptés : PNG, JPG, SVG<br />
                  Taille max : 2 MB<br />
                  Dimensions recommandées : 200x80 pixels
                </p>
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="show_logo_on_documents"
                  checked={formData.show_logo_on_documents || false}
                  onChange={handleChange}
                />
                Afficher le logo sur les devis et factures
              </label>
            </div>

            <div className="form-actions">
              <button
                className="btn-save"
                onClick={saveCompanyInfo}
                disabled={saveMutation.isPending || isUploading}
              >
                {isUploading ? 'Upload en cours...' : saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Invoicing */}
        {activeTab === 'invoicing' && (
          <div className="settings-section">
            <h2>Paramètres de facturation</h2>
            <p className="section-desc">Configurez les valeurs par défaut pour vos devis et factures</p>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="default_tax_rate">Taux de TVA par défaut (%)</label>
                <input
                  type="number"
                  id="default_tax_rate"
                  name="default_tax_rate"
                  value={formData.default_tax_rate || 20}
                  onChange={handleChange}
                  min={0}
                  max={100}
                  step={0.1}
                />
              </div>

              <div className="form-group">
                <label htmlFor="default_payment_terms">Délai de paiement (jours)</label>
                <input
                  type="number"
                  id="default_payment_terms"
                  name="default_payment_terms"
                  value={formData.default_payment_terms || 30}
                  onChange={handleChange}
                  min={0}
                />
              </div>

              <div className="form-group">
                <label htmlFor="quote_validity_days">Validité des devis (jours)</label>
                <input
                  type="number"
                  id="quote_validity_days"
                  name="quote_validity_days"
                  value={formData.quote_validity_days || 30}
                  onChange={handleChange}
                  min={1}
                />
              </div>

              <div className="form-group checkbox-inline">
                <label>
                  <input
                    type="checkbox"
                    name="show_siret"
                    checked={formData.show_siret || false}
                    onChange={handleChange}
                  />
                  Afficher le SIRET sur les documents
                </label>
              </div>

              <div className="form-group full-width">
                <label htmlFor="default_terms">Conditions générales par défaut</label>
                <textarea
                  id="default_terms"
                  name="default_terms"
                  value={formData.default_terms || ''}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Conditions de règlement, pénalités de retard, etc."
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="default_footer">Pied de page par défaut</label>
                <textarea
                  id="default_footer"
                  name="default_footer"
                  value={formData.default_footer || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Texte qui apparaîtra en bas des documents"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="legal_mentions">Mentions légales</label>
                <textarea
                  id="legal_mentions"
                  name="legal_mentions"
                  value={formData.legal_mentions || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Mentions légales obligatoires (assurance, garantie décennale, etc.)"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn-save"
                onClick={saveInvoiceSettings}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Bank Details */}
        {activeTab === 'bank' && (
          <div className="settings-section">
            <h2>Coordonnées bancaires</h2>
            <p className="section-desc">Ces informations peuvent être affichées sur vos factures</p>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="bank_name">Nom de la banque</label>
                <input
                  type="text"
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name || ''}
                  onChange={handleChange}
                  placeholder="Nom de votre banque"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bic">Code BIC/SWIFT</label>
                <input
                  type="text"
                  id="bic"
                  name="bic"
                  value={formData.bic || ''}
                  onChange={handleChange}
                  placeholder="BNPAFRPP"
                  maxLength={11}
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="iban">IBAN</label>
                <input
                  type="text"
                  id="iban"
                  name="iban"
                  value={formData.iban || ''}
                  onChange={handleChange}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                  maxLength={34}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn-save"
                onClick={saveInvoiceSettings}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Offline Mode */}
        {activeTab === 'offline' && (
          <div className="settings-section">
            <h2>📴 Mode hors ligne</h2>
            <p className="section-desc">
              Synchronisez vos données pour pouvoir utiliser l'application sans connexion Internet.
            </p>

            <div className="offline-sync-info">
              <h3>Fonctionnalités hors ligne :</h3>
              <ul>
                <li>✅ Consultation du planning et des interventions</li>
                <li>✅ Remplissage et génération des formulaires CERFA (PDF)</li>
                <li>✅ Accès aux informations clients et contrats</li>
                <li>✅ Consultation des profils d'équipe</li>
                <li>⚠️ Les modifications seront synchronisées une fois en ligne</li>
              </ul>

              <div className="sync-warning">
                <strong>⚠️ Important :</strong>
                <p>
                  Vous devez vous connecter <strong>EN LIGNE au moins une fois</strong> et cliquer
                  sur "Synchroniser" ci-dessous pour mettre vos données en cache.
                  Sans cela, le mode hors ligne ne fonctionnera pas.
                </p>
              </div>
            </div>

            {syncStats && (
              <div className="sync-stats">
                <h3>✅ Dernière synchronisation réussie</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Profils :</span>
                    <span className="stat-value">{syncStats.profiles || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Interventions :</span>
                    <span className="stat-value">{syncStats.interventions || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Contrats :</span>
                    <span className="stat-value">{syncStats.contracts || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Clients :</span>
                    <span className="stat-value">{syncStats.clients || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {isSyncing && (
              <div className="sync-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  />
                </div>
                <p className="progress-label">
                  {syncProgress.label} ({syncProgress.current}/{syncProgress.total})
                </p>
              </div>
            )}

            <div className="form-actions">
              <button
                className="btn-sync"
                onClick={handleSyncOfflineData}
                disabled={isSyncing}
              >
                {isSyncing ? '🔄 Synchronisation...' : '📥 Synchroniser pour mode hors ligne'}
              </button>
            </div>

            <div className="offline-instructions">
              <h3>Comment utiliser le mode hors ligne :</h3>
              <ol>
                <li>Cliquez sur <strong>"Synchroniser pour mode hors ligne"</strong> ci-dessus (connexion Internet requise)</li>
                <li>Attendez que la synchronisation se termine (quelques secondes)</li>
                <li>Déconnectez-vous de l'application</li>
                <li>Activez le <strong>mode avion</strong> ou coupez votre connexion</li>
                <li>Reconnectez-vous avec vos identifiants (connexion hors ligne)</li>
                <li>Utilisez l'application normalement !</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationSettingsPage;
