// =============================
// FILE: src/pages/ContractDetailView.js
// Detailed view of a single maintenance contract
// =============================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { prepareCerfaDataFromContract } from '../utils/cerfaService';
import { generateMaintenanceReportPDF } from '../utils/maintenanceReportPDF';
import EquipmentForm, { EQUIPMENT_TYPES } from '../components/contracts/EquipmentForm';
import MaintenanceReportForm from '../components/contracts/MaintenanceReportForm';
import './ContractDetailView.css';

// Contract type labels
const CONTRACT_TYPES = {
    entretien_chaudiere: 'Entretien Chaudière',
    climatisation: 'Climatisation',
    plomberie_generale: 'Plomberie Générale',
    pompe_chaleur: 'Pompe à Chaleur',
    chauffe_eau: 'Chauffe-eau',
    adoucisseur: 'Adoucisseur',
    vmc: 'VMC',
    multi_equipements: 'Multi-équipements',
    autre: 'Autre'
};

// Frequency labels
const FREQUENCIES = {
    monthly: 'Mensuel',
    bimonthly: 'Bimestriel',
    quarterly: 'Trimestriel',
    biannual: 'Semestriel',
    annual: 'Annuel'
};

// Status labels and colors
const STATUS_CONFIG = {
    active: { label: 'Actif', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    expired: { label: 'Expiré', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    pending_renewal: { label: 'À Renouveler', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    cancelled: { label: 'Annulé', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
    draft: { label: 'Brouillon', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    on_hold: { label: 'En pause', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
};

// Visit status labels
const VISIT_STATUS = {
    pending: { label: 'En attente', color: '#f59e0b', icon: '⏳' },
    scheduled: { label: 'Planifiée', color: '#3b82f6', icon: '📅' },
    confirmed: { label: 'Confirmée', color: '#10b981', icon: '✓' },
    in_progress: { label: 'En cours', color: '#8b5cf6', icon: '🔧' },
    completed: { label: 'Terminée', color: '#059669', icon: '✅' },
    missed: { label: 'Manquée', color: '#ef4444', icon: '❌' },
    rescheduled: { label: 'Reportée', color: '#6366f1', icon: '🔄' },
    cancelled: { label: 'Annulée', color: '#6b7280', icon: '🚫' }
};

// Equipment condition labels
const EQUIPMENT_CONDITION = {
    excellent: { label: 'Excellent', color: '#10b981' },
    good: { label: 'Bon', color: '#22c55e' },
    fair: { label: 'Correct', color: '#f59e0b' },
    poor: { label: 'Mauvais', color: '#ef4444' },
    needs_replacement: { label: 'À remplacer', color: '#dc2626' }
};

function ContractDetailView({
    contract,
    visits = [],
    equipment = [],
    history = [],
    reports = [],
    isLoading,
    error,
    onEdit,
    onDelete,
    onUpdateVisitStatus,
    onAddEquipment,
    onUpdateEquipment,
    onDeleteEquipment,
    onCreateReport,
    isAddingEquipment = false,
    isUpdatingEquipment = false,
    isCreatingReport = false,
    showToast
}) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('visits');
    const [showEquipmentForm, setShowEquipmentForm] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState(null);
    const [showReportForm, setShowReportForm] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Format helpers
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatPrice = (price) => {
        if (!price) return '-';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
    };

    // Calculate days until expiry
    const getDaysUntilExpiry = () => {
        if (!contract?.end_date) return null;
        const end = new Date(contract.end_date);
        const today = new Date();
        const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        return diff;
    };

    // Calculate visit stats
    const getVisitStats = () => {
        const total = visits.length;
        const completed = visits.filter(v => v.status === 'completed').length;
        const pending = visits.filter(v => ['pending', 'scheduled', 'confirmed'].includes(v.status)).length;
        const missed = visits.filter(v => v.status === 'missed').length;
        return { total, completed, pending, missed };
    };

    // Generate CERFA
    const handleGenerateCerfa = () => {
        const data = prepareCerfaDataFromContract(contract, { display_name: localStorage.getItem('user_name') || '' });
        const encodedData = encodeURIComponent(JSON.stringify(data));
        window.open(`/cerfa?data=${encodedData}`, '_blank');
    };

    // Handle delete
    const handleDelete = async () => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contrat ? Cette action est irréversible.')) return;
        try {
            await onDelete(contract.id);
            showToast?.('Contrat supprimé', 'success');
            navigate('/contracts');
        } catch (err) {
            showToast?.(`Erreur: ${err.message}`, 'error');
        }
    };

    // Equipment handlers
    const openAddEquipmentForm = () => {
        setEditingEquipment(null);
        setShowEquipmentForm(true);
    };

    const openEditEquipmentForm = (eq) => {
        setEditingEquipment(eq);
        setShowEquipmentForm(true);
    };

    const closeEquipmentForm = () => {
        setShowEquipmentForm(false);
        setEditingEquipment(null);
    };

    const handleEquipmentSubmit = async (data) => {
        try {
            if (editingEquipment) {
                await onUpdateEquipment?.(editingEquipment.id, data);
            } else {
                await onAddEquipment?.(data);
            }
            closeEquipmentForm();
        } catch (err) {
            showToast?.(`Erreur: ${err.message}`, 'error');
        }
    };

    const handleEquipmentDelete = async (equipmentId) => {
        if (!window.confirm('Supprimer cet équipement ?')) return;
        try {
            await onDeleteEquipment?.(equipmentId);
        } catch (err) {
            showToast?.(`Erreur: ${err.message}`, 'error');
        }
    };

    // Maintenance Report handlers
    const handleReportSubmit = async (reportData) => {
        setIsGeneratingReport(true);
        try {
            // Helper to convert empty strings to null, and parse numbers
            const sanitizeNumber = (val) => {
                if (val === '' || val === undefined || val === null) return null;
                const parsed = parseFloat(val);
                return isNaN(parsed) ? null : parsed;
            };
            const sanitizeString = (val) => (val && val.trim() !== '' ? val.trim() : null);

            // Add technician name from localStorage
            const techName = localStorage.getItem('user_name') || '';

            const fullReportData = {
                // Required fields
                intervention_type: reportData.intervention_type,
                intervention_date: reportData.intervention_date,
                technician_name: techName || null,
                visit_id: reportData.visit_id || null,

                // Arrays
                equipment_ids: reportData.equipment_ids || [],
                actions_performed: reportData.actions_performed || [],

                // Text fields
                custom_actions: sanitizeString(reportData.custom_actions),
                parts_replaced: sanitizeString(reportData.parts_replaced),
                observations: sanitizeString(reportData.observations),
                recommendations: sanitizeString(reportData.recommendations),
                next_visit_notes: sanitizeString(reportData.next_visit_notes),

                // Chaudière measurements
                co_reading: sanitizeNumber(reportData.co_reading),
                co2_reading: sanitizeNumber(reportData.co2_reading),
                combustion_efficiency: sanitizeNumber(reportData.combustion_efficiency),
                flue_temp: sanitizeNumber(reportData.flue_temp),
                water_pressure: sanitizeNumber(reportData.water_pressure),

                // Clim/PAC measurements
                refrigerant_pressure_hp: sanitizeNumber(reportData.refrigerant_pressure_hp),
                refrigerant_pressure_bp: sanitizeNumber(reportData.refrigerant_pressure_bp),
                superheat: sanitizeNumber(reportData.superheat),
                subcooling: sanitizeNumber(reportData.subcooling),
                water_temp_out: sanitizeNumber(reportData.water_temp_out),
                water_temp_in: sanitizeNumber(reportData.water_temp_in),
                defrost_ok: sanitizeString(reportData.defrost_ok),
                cop_estimated: sanitizeNumber(reportData.cop_estimated),

                // Cumulus measurements
                water_temp: sanitizeNumber(reportData.water_temp),
                anode_condition: sanitizeString(reportData.anode_condition),
                scale_level: sanitizeString(reportData.scale_level),

                // VMC measurements
                airflow_rate: sanitizeNumber(reportData.airflow_rate),
                noise_level: sanitizeString(reportData.noise_level),

                // Common
                filter_condition: sanitizeString(reportData.filter_condition),
                client_present: reportData.client_present,
                client_signature: reportData.client_signature || null
            };

            // 1. Sauvegarder en base de données
            if (onCreateReport) {
                await onCreateReport(fullReportData);
            }

            // 2. Générer et afficher le PDF
            generateMaintenanceReportPDF(fullReportData, contract, equipment);

            showToast?.('Rapport enregistré et généré', 'success');
            setShowReportForm(false);
        } catch (err) {
            showToast?.(`Erreur: ${err.message}`, 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    if (isLoading) {
        return (
            <div className="contract-detail-view">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Chargement du contrat...</p>
                </div>
            </div>
        );
    }

    if (error || !contract) {
        return (
            <div className="contract-detail-view">
                <div className="error-container">
                    <span className="error-icon">⚠️</span>
                    <h3>Contrat introuvable</h3>
                    <p>{error?.message || 'Ce contrat n\'existe pas ou a été supprimé.'}</p>
                    <button className="btn-primary" onClick={() => navigate('/contracts')}>
                        ← Retour aux contrats
                    </button>
                </div>
            </div>
        );
    }

    const daysUntilExpiry = getDaysUntilExpiry();
    const visitStats = getVisitStats();
    const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active;

    return (
        <div className="contract-detail-view">
            {/* Back Navigation */}
            <button className="back-button" onClick={() => navigate('/contracts')}>
                ← Retour aux contrats
            </button>

            {/* Header */}
            <header className="contract-detail-header">
                <div className="header-main">
                    <div className="client-info">
                        <h1>{contract.client_name}</h1>
                        <span className="contract-type-badge">
                            {CONTRACT_TYPES[contract.contract_type] || contract.contract_type}
                        </span>
                    </div>
                    <div
                        className="status-badge"
                        style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                    >
                        {statusConfig.label}
                    </div>
                </div>

                {/* Expiry Alert */}
                {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
                    <div className="expiry-alert warning">
                        ⚠️ Ce contrat expire dans {daysUntilExpiry} jour{daysUntilExpiry > 1 ? 's' : ''}
                    </div>
                )}
                {daysUntilExpiry !== null && daysUntilExpiry <= 0 && (
                    <div className="expiry-alert danger">
                        ❌ Ce contrat a expiré il y a {Math.abs(daysUntilExpiry)} jour{Math.abs(daysUntilExpiry) > 1 ? 's' : ''}
                    </div>
                )}

                {/* Quick Stats */}
                <div className="quick-stats">
                    <div className="stat-item">
                        <span className="stat-value">{formatPrice(contract.price)}</span>
                        <span className="stat-label">Prix annuel</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{FREQUENCIES[contract.frequency] || contract.frequency}</span>
                        <span className="stat-label">Fréquence</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{visitStats.completed}/{visitStats.total}</span>
                        <span className="stat-label">Visites effectuées</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{contract.contract_number || '-'}</span>
                        <span className="stat-label">N° Contrat</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="header-actions">
                    <button className="btn-primary" onClick={() => setShowReportForm(true)}>
                        📋 Rapport d'entretien
                    </button>
                    {contract.contract_type === 'entretien_chaudiere' && (
                        <button className="btn-secondary" onClick={handleGenerateCerfa}>
                            📄 CERFA
                        </button>
                    )}
                    <button className="btn-secondary" onClick={() => onEdit?.(contract)}>
                        ✏️ Modifier
                    </button>
                    <button className="btn-danger" onClick={handleDelete}>
                        🗑️ Supprimer
                    </button>
                </div>
            </header>

            {/* Client Details Card */}
            <section className="detail-card">
                <h2>👤 Informations Client</h2>
                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">📍 Adresse</span>
                        <span className="info-value">{contract.client_address || '-'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">📞 Téléphone</span>
                        <span className="info-value">
                            {contract.client_phone ? (
                                <a href={`tel:${contract.client_phone}`}>{contract.client_phone}</a>
                            ) : '-'}
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">📱 Tél. secondaire</span>
                        <span className="info-value">{contract.client_secondary_phone || '-'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">✉️ Email</span>
                        <span className="info-value">
                            {contract.client_email ? (
                                <a href={`mailto:${contract.client_email}`}>{contract.client_email}</a>
                            ) : '-'}
                        </span>
                    </div>
                    {contract.access_instructions && (
                        <div className="info-item full-width">
                            <span className="info-label">🔑 Instructions d'accès</span>
                            <span className="info-value">{contract.access_instructions}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Contract Details Card */}
            <section className="detail-card">
                <h2>📋 Détails du Contrat</h2>
                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">📅 Date de début</span>
                        <span className="info-value">{formatDate(contract.start_date)}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">📅 Date de fin</span>
                        <span className="info-value">{formatDate(contract.end_date)}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">🔄 Renouvellement auto</span>
                        <span className="info-value">{contract.auto_renew ? '✅ Oui' : '❌ Non'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">👷 Technicien préféré</span>
                        <span className="info-value">
                            {contract.preferred_technician?.display_name || contract.preferred_technician?.full_name || '-'}
                        </span>
                    </div>
                    {contract.equipment_details && (
                        <div className="info-item full-width">
                            <span className="info-label">🔧 Équipement</span>
                            <span className="info-value">{contract.equipment_details}</span>
                        </div>
                    )}
                    {contract.notes && (
                        <div className="info-item full-width">
                            <span className="info-label">📝 Notes</span>
                            <span className="info-value">{contract.notes}</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Tabs Section */}
            <div className="tabs-container">
                <div className="tabs-header">
                    <button
                        className={`tab-btn ${activeTab === 'visits' ? 'active' : ''}`}
                        onClick={() => setActiveTab('visits')}
                    >
                        🗓️ Visites ({visits.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'equipment' ? 'active' : ''}`}
                        onClick={() => setActiveTab('equipment')}
                    >
                        🔧 Équipements ({equipment.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        📋 Rapports ({reports.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        📜 Historique ({history.length})
                    </button>
                </div>

                <div className="tabs-content">
                    {/* Visits Tab */}
                    {activeTab === 'visits' && (
                        <div className="visits-tab">
                            {visits.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📅</span>
                                    <p>Aucune visite planifiée</p>
                                </div>
                            ) : (
                                <div className="visits-timeline">
                                    {visits.map((visit, index) => {
                                        const visitStatus = VISIT_STATUS[visit.status] || VISIT_STATUS.pending;
                                        const isPast = new Date(visit.scheduled_date) < new Date();

                                        return (
                                            <div
                                                key={visit.id}
                                                className={`visit-item ${isPast ? 'past' : 'future'} ${visit.status}`}
                                            >
                                                <div className="visit-marker">
                                                    <span style={{ color: visitStatus.color }}>{visitStatus.icon}</span>
                                                </div>
                                                <div className="visit-content">
                                                    <div className="visit-header">
                                                        <span className="visit-date">{formatDate(visit.scheduled_date)}</span>
                                                        <span
                                                            className="visit-status"
                                                            style={{ color: visitStatus.color }}
                                                        >
                                                            {visitStatus.label}
                                                        </span>
                                                    </div>
                                                    {visit.scheduled_time && (
                                                        <span className="visit-time">🕐 {visit.scheduled_time}</span>
                                                    )}
                                                    {visit.technician_notes && (
                                                        <p className="visit-notes">📝 {visit.technician_notes}</p>
                                                    )}
                                                    {visit.intervention_id && (
                                                        <button
                                                            className="btn-link"
                                                            onClick={() => navigate(`/interventions/${visit.intervention_id}`)}
                                                        >
                                                            → Voir l'intervention
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Equipment Tab */}
                    {activeTab === 'equipment' && (
                        <div className="equipment-tab">
                            <div className="tab-actions">
                                <button className="btn-primary" onClick={openAddEquipmentForm}>
                                    ➕ Ajouter un équipement
                                </button>
                            </div>

                            {equipment.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">🔧</span>
                                    <p>Aucun équipement enregistré</p>
                                    <button className="btn-secondary" onClick={openAddEquipmentForm}>
                                        Ajouter le premier équipement
                                    </button>
                                </div>
                            ) : (
                                <div className="equipment-list">
                                    {equipment.map((eq) => {
                                        const condition = EQUIPMENT_CONDITION[eq.condition] || EQUIPMENT_CONDITION.good;
                                        const typeName = EQUIPMENT_TYPES[eq.equipment_type] || eq.equipment_type;

                                        return (
                                            <div key={eq.id} className="equipment-card">
                                                <div className="equipment-header">
                                                    <h4>{typeName}</h4>
                                                    <div className="equipment-actions">
                                                        <span
                                                            className="condition-badge"
                                                            style={{ color: condition.color }}
                                                        >
                                                            {condition.label}
                                                        </span>
                                                        <button
                                                            className="btn-icon-sm"
                                                            onClick={() => openEditEquipmentForm(eq)}
                                                            title="Modifier"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className="btn-icon-sm delete"
                                                            onClick={() => handleEquipmentDelete(eq.id)}
                                                            title="Supprimer"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="equipment-details">
                                                    {eq.brand && <span><strong>Marque:</strong> {eq.brand}</span>}
                                                    {eq.model && <span><strong>Modèle:</strong> {eq.model}</span>}
                                                    {eq.serial_number && <span><strong>N° série:</strong> {eq.serial_number}</span>}
                                                    {eq.location && <span>📍 {eq.location}</span>}
                                                    {eq.installation_date && (
                                                        <span><strong>Installé:</strong> {formatDate(eq.installation_date)}</span>
                                                    )}
                                                    {eq.warranty_end_date && (
                                                        <span><strong>Garantie:</strong> {formatDate(eq.warranty_end_date)}</span>
                                                    )}
                                                </div>
                                                {eq.notes && <p className="equipment-notes">📝 {eq.notes}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reports Tab */}
                    {activeTab === 'reports' && (
                        <div className="reports-tab">
                            <div className="tab-actions">
                                <button className="btn-primary" onClick={() => setShowReportForm(true)}>
                                    ➕ Nouveau rapport
                                </button>
                            </div>

                            {reports.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📋</span>
                                    <p>Aucun rapport d'entretien</p>
                                    <button className="btn-secondary" onClick={() => setShowReportForm(true)}>
                                        Créer le premier rapport
                                    </button>
                                </div>
                            ) : (
                                <div className="reports-list">
                                    {reports.map((report) => (
                                        <div key={report.id} className="report-card">
                                            <div className="report-header">
                                                <div className="report-info">
                                                    <h4>
                                                        {report.intervention_type === 'entretien_annuel' ? 'Entretien annuel' :
                                                            report.intervention_type === 'entretien_semestriel' ? 'Entretien semestriel' :
                                                                report.intervention_type === 'depannage' ? 'Dépannage' :
                                                                    report.intervention_type}
                                                    </h4>
                                                    <span className="report-date">
                                                        📅 {formatDate(report.intervention_date)}
                                                    </span>
                                                </div>
                                                <button
                                                    className="btn-secondary"
                                                    onClick={() => generateMaintenanceReportPDF(report, contract, equipment)}
                                                    title="Imprimer le rapport"
                                                >
                                                    🖨️ Imprimer
                                                </button>
                                            </div>
                                            <div className="report-details">
                                                {report.technician_name && (
                                                    <span>👷 {report.technician_name}</span>
                                                )}
                                                {report.actions_performed?.length > 0 && (
                                                    <span>✅ {report.actions_performed.length} action(s)</span>
                                                )}
                                                {report.client_signature && (
                                                    <span className="signed-badge">✍️ Signé</span>
                                                )}
                                            </div>
                                            {report.observations && (
                                                <p className="report-observations">📝 {report.observations}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div className="history-tab">
                            {history.length === 0 ? (
                                <div className="empty-state">
                                    <span className="empty-icon">📜</span>
                                    <p>Aucun historique disponible</p>
                                </div>
                            ) : (
                                <div className="history-timeline">
                                    {history.map((entry) => (
                                        <div key={entry.id} className="history-item">
                                            <div className="history-marker">•</div>
                                            <div className="history-content">
                                                <div className="history-header">
                                                    <span className="history-action">{entry.action}</span>
                                                    <span className="history-date">{formatDateTime(entry.created_at)}</span>
                                                </div>
                                                {entry.profiles?.display_name && (
                                                    <span className="history-author">par {entry.profiles.display_name}</span>
                                                )}
                                                {entry.notes && <p className="history-notes">{entry.notes}</p>}
                                                {entry.changes && typeof entry.changes === 'object' && (
                                                    <div className="history-changes">
                                                        {Array.isArray(entry.changes) ? (
                                                            entry.changes.map((change, i) => (
                                                                <span key={i} className="change-item">
                                                                    {change.field}: {change.old_value} → {change.new_value}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="change-item">
                                                                {entry.changes.field}: {entry.changes.old_value} → {entry.changes.new_value}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Equipment Form Modal */}
            <EquipmentForm
                isOpen={showEquipmentForm}
                onClose={closeEquipmentForm}
                onSubmit={handleEquipmentSubmit}
                editingEquipment={editingEquipment}
                isSubmitting={isAddingEquipment || isUpdatingEquipment}
            />

            {/* Maintenance Report Form Modal */}
            <MaintenanceReportForm
                isOpen={showReportForm}
                onClose={() => setShowReportForm(false)}
                onSubmit={handleReportSubmit}
                contract={contract}
                equipment={equipment}
                technician={localStorage.getItem('user_name') || ''}
                isSubmitting={isGeneratingReport}
            />
        </div>
    );
}

export default ContractDetailView;
