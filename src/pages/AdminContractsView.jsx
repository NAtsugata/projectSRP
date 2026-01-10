// =============================
// FILE: src/pages/AdminContractsView.js
// Admin view for managing maintenance contracts
// =============================
import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { prepareCerfaDataFromContract } from '../utils/cerfaService';
import './AdminContractsView.css';

// Contract type labels
const CONTRACT_TYPES = {
    entretien_chaudiere: 'Entretien Chaudière',
    climatisation: 'Climatisation',
    plomberie_generale: 'Plomberie Générale',
    pompe_chaleur: 'Pompe à Chaleur',
    autre: 'Autre'
};

// Frequency labels
const FREQUENCIES = {
    monthly: 'Mensuel',
    quarterly: 'Trimestriel',
    biannual: 'Semestriel',
    annual: 'Annuel'
};

// Status labels
const STATUS_LABELS = {
    active: 'Actif',
    expired: 'Expiré',
    pending_renewal: 'À Renouveler',
    cancelled: 'Annulé'
};

// Initial form state
const INITIAL_FORM = {
    client_name: '',
    client_address: '',
    client_phone: '',
    client_email: '',
    contract_type: 'entretien_chaudiere',
    contract_number: '',
    start_date: '',
    end_date: '',
    frequency: 'annual',
    price: '',
    notes: '',
    equipment_details: '',
    renewal_reminder_days: 30,
    auto_renew: false
};

function AdminContractsView({
    contracts = [],
    stats = null,
    isLoading,
    error,
    onCreateContract,
    onUpdateContract,
    onDeleteContract,
    showToast
}) {
    const [showModal, setShowModal] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [filters, setFilters] = useState({ status: '', type: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, contractId: null, contractName: '' });
    const navigate = useNavigate();
    const location = useLocation();
    // Les états CERFA sont supprimés car on ouvre dans un nouvel onglet

    // Gestion de l'édition depuis la navigation (state)
    React.useEffect(() => {
        if (location.state?.editContract) {
            handleEditContract(location.state.editContract);
            // Nettoyer le state
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Open modal for new contract
    const handleNewContract = useCallback(() => {
        setEditingContract(null);
        setFormData({
            ...INITIAL_FORM,
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        setShowModal(true);
    }, []);

    // Open modal for editing
    const handleEditContract = useCallback((contract) => {
        setEditingContract(contract);
        setFormData({
            client_name: contract.client_name || '',
            client_address: contract.client_address || '',
            client_phone: contract.client_phone || '',
            client_email: contract.client_email || '',
            contract_type: contract.contract_type || 'entretien_chaudiere',
            contract_number: contract.contract_number || '',
            start_date: contract.start_date || '',
            end_date: contract.end_date || '',
            frequency: contract.frequency || 'annual',
            price: contract.price || '',
            notes: contract.notes || '',
            equipment_details: contract.equipment_details || '',
            renewal_reminder_days: contract.renewal_reminder_days || 30,
            auto_renew: contract.auto_renew || false
        });
        setShowModal(true);
    }, []);

    // Close modal
    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setEditingContract(null);
        setFormData(INITIAL_FORM);
    }, []);

    // Handle form input change
    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    // Submit form
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        if (!formData.client_name || !formData.start_date || !formData.end_date) {
            showToast?.('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        // Sanitize data: convert empty strings to null for optional fields
        const sanitizedData = {
            ...formData,
            contract_number: formData.contract_number?.trim() || null,
            client_address: formData.client_address?.trim() || null,
            client_phone: formData.client_phone?.trim() || null,
            client_email: formData.client_email?.trim() || null,
            notes: formData.notes?.trim() || null,
            equipment_details: formData.equipment_details?.trim() || null,
            price: formData.price ? parseFloat(formData.price) : null,
            renewal_reminder_days: parseInt(formData.renewal_reminder_days) || 30,
            auto_renew: Boolean(formData.auto_renew)
        };

        console.log('Submitting contract data:', sanitizedData);

        setIsSubmitting(true);
        try {
            if (editingContract) {
                await onUpdateContract({ id: editingContract.id, updates: sanitizedData });
                showToast?.('Contrat mis à jour avec succès', 'success');
            } else {
                await onCreateContract(sanitizedData);
                showToast?.('Contrat créé avec succès', 'success');
            }
            handleCloseModal();
        } catch (err) {
            console.error('Contract submit error:', err);
            showToast?.(`Erreur: ${err.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, editingContract, onCreateContract, onUpdateContract, showToast, handleCloseModal]);

    // Delete contract - show confirmation
    const handleDeleteClick = useCallback((contract) => {
        setDeleteConfirm({
            show: true,
            contractId: contract.id,
            contractName: contract.client_name
        });
    }, []);

    // Confirm delete
    const confirmDelete = useCallback(async () => {
        if (!deleteConfirm.contractId) return;

        try {
            console.log('Deleting contract:', deleteConfirm.contractId);
            await onDeleteContract(deleteConfirm.contractId);
            showToast?.('Contrat supprimé', 'success');
        } catch (err) {
            console.error('Delete contract error:', err);
            showToast?.(`Erreur: ${err.message}`, 'error');
        } finally {
            setDeleteConfirm({ show: false, contractId: null, contractName: '' });
        }
    }, [deleteConfirm.contractId, onDeleteContract, showToast]);

    // Cancel delete
    const cancelDelete = useCallback(() => {
        setDeleteConfirm({ show: false, contractId: null, contractName: '' });
    }, []);

    // Generate CERFA - Ouvre dans un nouvel onglet
    const handleGenerateCerfa = useCallback((contract) => {
        const data = prepareCerfaDataFromContract(contract, { display_name: localStorage.getItem('user_name') || '' });
        // Encode les données en JSON pour les passer via URL
        const encodedData = encodeURIComponent(JSON.stringify(data));
        // Ouvre le formulaire CERFA dans un nouvel onglet
        window.open(`/cerfa?data=${encodedData}`, '_blank');
    }, []);

    // Filter contracts with search
    const filteredContracts = contracts.filter(c => {
        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesName = c.client_name?.toLowerCase().includes(term);
            const matchesPhone = c.client_phone?.toLowerCase().includes(term);
            const matchesAddress = c.client_address?.toLowerCase().includes(term);
            const matchesNumber = c.contract_number?.toLowerCase().includes(term);
            if (!matchesName && !matchesPhone && !matchesAddress && !matchesNumber) return false;
        }
        // Status filter
        if (filters.status && c.status !== filters.status) return false;
        // Type filter
        if (filters.type && c.contract_type !== filters.type) return false;
        return true;
    });

    // Sort by expiry date (soonest first), then by status
    const sortedContracts = [...filteredContracts].sort((a, b) => {
        // Priority for pending_renewal
        if (a.status === 'pending_renewal' && b.status !== 'pending_renewal') return -1;
        if (b.status === 'pending_renewal' && a.status !== 'pending_renewal') return 1;
        // Then by end date
        return new Date(a.end_date) - new Date(b.end_date);
    });

    // Calculate days until expiry
    const getDaysUntilExpiry = (endDate) => {
        if (!endDate) return null;
        const end = new Date(endDate);
        const today = new Date();
        return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR');
    };

    // Format price
    const formatPrice = (price) => {
        if (!price) return '-';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
    };

    if (isLoading) {
        return (
            <div className="contracts-view">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Chargement des contrats...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="contracts-view">
                <div className="empty-state">
                    <div className="icon">⚠️</div>
                    <h3>Erreur de chargement</h3>
                    <p>{error.message || 'Impossible de charger les contrats'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="contracts-view">
            {/* Header */}
            <div className="contracts-header">
                <h1>
                    <span className="icon">📋</span>
                    Contrats de Maintenance
                </h1>
                <button className="btn-primary" onClick={handleNewContract}>
                    <span>➕</span>
                    Nouveau Contrat
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="contracts-stats">
                    <div className="stat-card">
                        <div className="stat-icon active">✓</div>
                        <div className="stat-content">
                            <h3>Actifs</h3>
                            <div className="value">{stats.active}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon pending">⏳</div>
                        <div className="stat-content">
                            <h3>À Renouveler</h3>
                            <div className="value">{stats.pendingRenewal}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon expired">✕</div>
                        <div className="stat-content">
                            <h3>Expirés</h3>
                            <div className="value">{stats.expired}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon revenue">€</div>
                        <div className="stat-content">
                            <h3>Revenus Annuels</h3>
                            <div className="value">{formatPrice(stats.totalRevenue)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="contracts-toolbar">
                {/* Search */}
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Rechercher par nom, téléphone, adresse..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            className="search-clear"
                            onClick={() => setSearchTerm('')}
                            aria-label="Effacer la recherche"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="contracts-filters">
                    <select
                        className="filter-select"
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Tous les statuts</option>
                        <option value="active">Actifs</option>
                        <option value="pending_renewal">À Renouveler</option>
                        <option value="expired">Expirés</option>
                        <option value="cancelled">Annulés</option>
                    </select>
                    <select
                        className="filter-select"
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                    >
                        <option value="">Tous les types</option>
                        {Object.entries(CONTRACT_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results count */}
            <div className="results-info">
                {sortedContracts.length} contrat{sortedContracts.length !== 1 ? 's' : ''} trouvé{sortedContracts.length !== 1 ? 's' : ''}
                {searchTerm && <span> pour "{searchTerm}"</span>}
            </div>

            {/* Contracts List */}
            {sortedContracts.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📋</div>
                    <h3>{searchTerm ? 'Aucun résultat' : 'Aucun contrat'}</h3>
                    <p>{searchTerm ? 'Essayez avec d\'autres termes' : 'Créez votre premier contrat de maintenance'}</p>
                </div>
            ) : (
                <div className="contracts-list">
                    {sortedContracts.map(contract => {
                        const daysUntilExpiry = getDaysUntilExpiry(contract.end_date);
                        const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;
                        const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

                        return (
                            <div
                                key={contract.id}
                                className={`contract-card clickable ${isExpiringSoon ? 'expiring-soon' : ''} ${isExpired ? 'expired-card' : ''}`}
                                onClick={() => navigate(`/contracts/${contract.id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && navigate(`/contracts/${contract.id}`)}
                            >
                                {/* Expiry Alert Badge */}
                                {isExpiringSoon && (
                                    <div className="expiry-alert-badge warning">
                                        ⚠️ Expire dans {daysUntilExpiry} jour{daysUntilExpiry > 1 ? 's' : ''}
                                    </div>
                                )}
                                {isExpired && (
                                    <div className="expiry-alert-badge danger">
                                        ❌ Expiré depuis {Math.abs(daysUntilExpiry)} jour{Math.abs(daysUntilExpiry) > 1 ? 's' : ''}
                                    </div>
                                )}

                                <div className="contract-card-header">
                                    <div className="contract-client">
                                        <span className="contract-client-name">{contract.client_name}</span>
                                        <span className="contract-type">{CONTRACT_TYPES[contract.contract_type] || contract.contract_type}</span>
                                    </div>
                                    <span className={`contract-status ${contract.status}`}>
                                        {STATUS_LABELS[contract.status] || contract.status}
                                    </span>
                                </div>

                                <div className="contract-card-body">
                                    <div className="contract-info-item">
                                        <span className="label">📅 Période</span>
                                        <span className="value">{formatDate(contract.start_date)} → {formatDate(contract.end_date)}</span>
                                    </div>
                                    <div className="contract-info-item">
                                        <span className="label">🔄 Fréquence</span>
                                        <span className="value">{FREQUENCIES[contract.frequency] || contract.frequency}</span>
                                    </div>
                                    <div className="contract-info-item">
                                        <span className="label">💰 Prix</span>
                                        <span className="value price-value">{formatPrice(contract.price)}</span>
                                    </div>
                                    {contract.client_phone && (
                                        <div className="contract-info-item">
                                            <span className="label">📞 Tél.</span>
                                            <span className="value">{contract.client_phone}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="contract-card-footer">
                                    <div className="contract-visits-badge">
                                        <span>🗓️</span>
                                        <span>Visites planifiées</span>
                                    </div>
                                    <div className="contract-actions">
                                        {contract.contract_type === 'entretien_chaudiere' && (
                                            <button
                                                className="btn-icon cerfa"
                                                onClick={(e) => { e.stopPropagation(); handleGenerateCerfa(contract); }}
                                                title="Générer CERFA"
                                            >
                                                📄
                                            </button>
                                        )}
                                        <button
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); handleEditContract(contract); }}
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn-icon delete"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(contract); }}
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContract ? 'Modifier le Contrat' : 'Nouveau Contrat'}</h2>
                            <button className="modal-close" onClick={handleCloseModal}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Nom du client *</label>
                                    <input
                                        type="text"
                                        name="client_name"
                                        value={formData.client_name}
                                        onChange={handleInputChange}
                                        placeholder="Jean Dupont"
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Téléphone</label>
                                        <input
                                            type="tel"
                                            name="client_phone"
                                            value={formData.client_phone}
                                            onChange={handleInputChange}
                                            placeholder="06 12 34 56 78"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            name="client_email"
                                            value={formData.client_email}
                                            onChange={handleInputChange}
                                            placeholder="client@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Adresse</label>
                                    <input
                                        type="text"
                                        name="client_address"
                                        value={formData.client_address}
                                        onChange={handleInputChange}
                                        placeholder="123 rue de la Plomberie, 75001 Paris"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Type de contrat *</label>
                                        <select
                                            name="contract_type"
                                            value={formData.contract_type}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            {Object.entries(CONTRACT_TYPES).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>N° de contrat</label>
                                        <input
                                            type="text"
                                            name="contract_number"
                                            value={formData.contract_number}
                                            onChange={handleInputChange}
                                            placeholder="CONT-2024-001"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Date de début *</label>
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date de fin *</label>
                                        <input
                                            type="date"
                                            name="end_date"
                                            value={formData.end_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Toggle Renouvellement Auto */}
                                <div
                                    className={`form-group toggle-group ${formData.auto_renew ? 'active' : ''}`}
                                    onClick={() => setFormData(prev => ({ ...prev, auto_renew: !prev.auto_renew }))}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="toggle-container">
                                        <div className={`toggle-switch ${formData.auto_renew ? 'on' : ''}`}>
                                            <div className="toggle-knob"></div>
                                        </div>
                                        <div className="toggle-text">
                                            <span>🔄 Renouvellement automatique</span>
                                            <small>Le contrat sera renouvelé automatiquement à échéance</small>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Fréquence des visites *</label>
                                        <select
                                            name="frequency"
                                            value={formData.frequency}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            {Object.entries(FREQUENCIES).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Prix annuel (€)</label>
                                        <input
                                            type="number"
                                            name="price"
                                            value={formData.price}
                                            onChange={handleInputChange}
                                            placeholder="150"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Détails équipement</label>
                                    <textarea
                                        name="equipment_details"
                                        value={formData.equipment_details}
                                        onChange={handleInputChange}
                                        placeholder="Marque, modèle, numéro de série..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        placeholder="Informations supplémentaires..."
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                                    Annuler
                                </button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Enregistrement...' : (editingContract ? 'Mettre à jour' : 'Créer le contrat')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Le CERFA s'ouvre maintenant dans un nouvel onglet */}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>⚠️ Confirmer la suppression</h2>
                            <button className="modal-close" onClick={cancelDelete}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p>Êtes-vous sûr de vouloir supprimer le contrat de <strong>{deleteConfirm.contractName}</strong> ?</p>
                            <p className="warning-text">Cette action est irréversible. Toutes les visites associées seront également supprimées.</p>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={cancelDelete}>
                                Annuler
                            </button>
                            <button type="button" className="btn-danger" onClick={confirmDelete}>
                                🗑️ Supprimer définitivement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminContractsView;
