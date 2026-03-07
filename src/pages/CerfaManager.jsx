// =============================
// FILE: src/pages/CerfaManager.js
// Gestionnaire de PDF CERFA
// =============================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import {
    FileTextIcon, DownloadIcon, UploadIcon,
    TrashIcon, ExternalLinkIcon, SearchIcon,
    PlusIcon, EditIcon
} from '../components/SharedUI';
import './CerfaManager.css';
import logger from '../utils/logger';

// Templates CERFA disponibles
const CERFA_TEMPLATES = [
    {
        id: 'cerfa_15497-04',
        name: 'CERFA 15497-04',
        description: 'Fiche d\'intervention - Fluides frigorigènes',
        path: '/cerfa-form',  // Formulaire HTML mobile-friendly
        pdfPath: '/cerfa/cerfa_15497-04.pdf',  // PDF pour référence
        category: 'clim'
    },
    {
        id: 'cerfa_15498',
        name: 'CERFA 15498',
        description: 'Attestation d\'acquisition de fluides frigorigènes',
        path: '/cerfa-form-15498',  // Formulaire HTML mobile-friendly
        pdfPath: '/cerfa/CERFA_15498_Interactif_V2_PRO.pdf',  // PDF pour référence
        category: 'clim'
    },
    {
        id: 'cerfa_1301-sd',
        name: 'CERFA 1301-SD',
        description: 'Attestation simplifiée TVA taux réduit 10%',
        path: '/cerfa-form-1301',  // Formulaire HTML mobile-friendly
        pdfPath: '/cerfa/cerfa_1301-sd.pdf',  // PDF pour référence
        category: 'tva'
    },
];

// Icône pour les groupes
const ChevronDownIcon = ({ size = 18, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

const UsersIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
);

const ListIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
);

function CerfaManager() {
    const navigate = useNavigate();
    const toast = useToast();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadData, setUploadData] = useState({
        numero: '',
        templateName: '',
        clientName: '',
        interventionDate: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [editingNumero, setEditingNumero] = useState(null);
    const [viewMode, setViewMode] = useState('clients'); // 'list' ou 'clients'
    const [expandedClients, setExpandedClients] = useState({});

    // Charger les documents
    const loadDocuments = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('cerfa_documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            logger.error('Erreur chargement documents:', error);
            toast.error('Erreur lors du chargement des documents');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Obtenir le prochain numéro via la fonction SQL
    const getNextNumero = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_next_cerfa_numero');
            if (error) throw error;
            return data;
        } catch {
            // Fallback local si la fonction SQL échoue
            const currentYear = new Date().getFullYear();
            const count = documents.length + 1;
            return `CERFA-${currentYear}-${String(count).padStart(4, '0')}`;
        }
    }, [documents.length]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    useEffect(() => {
        const fetchNextNumero = async () => {
            const num = await getNextNumero();
            setUploadData(prev => ({ ...prev, numero: num }));
        };
        fetchNextNumero();
    }, [getNextNumero, documents]);

    // Filtrer les documents
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc =>
            doc.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (doc.client_name && doc.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (doc.template_name && doc.template_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [documents, searchTerm]);

    // Grouper les documents par client
    const groupedByClient = useMemo(() => {
        const groups = {};
        filteredDocuments.forEach(doc => {
            const clientName = doc.client_name || 'Non spécifié';
            if (!groups[clientName]) {
                groups[clientName] = {
                    name: clientName,
                    documents: [],
                    lastDate: null,
                    templates: new Set()
                };
            }
            groups[clientName].documents.push(doc);
            groups[clientName].templates.add(doc.template_name || 'Non spécifié');
            const docDate = new Date(doc.created_at);
            if (!groups[clientName].lastDate || docDate > groups[clientName].lastDate) {
                groups[clientName].lastDate = docDate;
            }
        });

        // Convertir en tableau et trier par date de dernier document
        return Object.values(groups).sort((a, b) => {
            if (!a.lastDate) return 1;
            if (!b.lastDate) return -1;
            return b.lastDate - a.lastDate;
        });
    }, [filteredDocuments]);

    // Toggle expansion d'un client
    const toggleClientExpand = (clientName) => {
        setExpandedClients(prev => ({
            ...prev,
            [clientName]: !prev[clientName]
        }));
    };

    // Expand all clients
    const expandAllClients = () => {
        const all = {};
        groupedByClient.forEach(group => {
            all[group.name] = true;
        });
        setExpandedClients(all);
    };

    // Collapse all clients
    const collapseAllClients = () => {
        setExpandedClients({});
    };

    // Ouvrir un template PDF
    const openTemplate = (template) => {
        navigate(template.path);
    };

    // Gérer la sélection de fichier
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else {
            toast.error('Veuillez sélectionner un fichier PDF');
        }
    };

    // Upload du PDF rempli
    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Veuillez sélectionner un fichier');
            return;
        }
        if (!uploadData.numero) {
            toast.error('Le numéro est requis');
            return;
        }

        setUploading(true);
        try {
            // Upload vers Supabase Storage
            const fileName = `${uploadData.numero}_${Date.now()}.pdf`;
            const filePath = `cerfa/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('cerfa-documents')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            // Enregistrer dans la base de données
            const { error: dbError } = await supabase
                .from('cerfa_documents')
                .insert({
                    numero: uploadData.numero,
                    template_name: uploadData.templateName || 'Non spécifié',
                    file_path: filePath,
                    file_name: fileName,
                    client_name: uploadData.clientName,
                    intervention_date: uploadData.interventionDate || null,
                    notes: uploadData.notes
                });

            if (dbError) throw dbError;

            toast.success('Document enregistré avec succès !');
            setShowUploadModal(false);
            setSelectedFile(null);
            setUploadData({
                numero: '',
                templateName: '',
                clientName: '',
                interventionDate: new Date().toISOString().split('T')[0],
                notes: ''
            });
            loadDocuments();
        } catch (error) {
            logger.error('Erreur upload:', error);
            toast.error(`Erreur: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    // Télécharger un document
    const downloadDocument = async (doc) => {
        try {
            const { data, error } = await supabase.storage
                .from('cerfa-documents')
                .download(doc.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            logger.error('Erreur téléchargement:', error);
            toast.error('Erreur lors du téléchargement');
        }
    };

    // Modifier le numéro d'un document
    const updateNumero = async (docId, newNumero) => {
        try {
            const { error } = await supabase
                .from('cerfa_documents')
                .update({ numero: newNumero })
                .eq('id', docId);

            if (error) throw error;
            toast.success('Numéro modifié');
            setEditingNumero(null);
            loadDocuments();
        } catch (error) {
            toast.error(`Erreur: ${error.message}`);
        }
    };

    // Supprimer un document
    const deleteDocument = async (doc) => {
        if (!window.confirm(`Supprimer ${doc.numero} ?`)) return;

        try {
            // Supprimer le fichier du storage
            await supabase.storage
                .from('cerfa-documents')
                .remove([doc.file_path]);

            // Supprimer de la base
            const { error } = await supabase
                .from('cerfa_documents')
                .delete()
                .eq('id', doc.id);

            if (error) throw error;
            toast.success('Document supprimé');
            loadDocuments();
        } catch (error) {
            toast.error(`Erreur: ${error.message}`);
        }
    };

    // Rendu d'une carte document
    const renderDocumentCard = (doc, compact = false) => (
        <div key={doc.id} className={`cerfa-document-card ${compact ? 'compact' : ''}`}>
            <div className="doc-icon">
                <FileTextIcon size={compact ? 18 : 24} />
            </div>
            <div className="doc-info">
                {editingNumero === doc.id ? (
                    <input
                        type="text"
                        defaultValue={doc.numero}
                        onBlur={(e) => updateNumero(doc.id, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                updateNumero(doc.id, e.target.value);
                            }
                        }}
                        autoFocus
                        className="edit-numero-input"
                    />
                ) : (
                    <h4 onClick={() => setEditingNumero(doc.id)}>
                        {doc.numero}
                        <EditIcon size={14} className="edit-icon" />
                    </h4>
                )}
                {!compact && <p>{doc.client_name || 'Client non spécifié'}</p>}
                <span className="doc-meta">
                    <span className="doc-template">{doc.template_name || 'Non spécifié'}</span>
                    <span className="doc-date">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </span>
                </span>
            </div>
            <div className="doc-actions">
                <button
                    className="btn-icon"
                    onClick={() => downloadDocument(doc)}
                    title="Télécharger"
                >
                    <DownloadIcon size={18} />
                </button>
                <button
                    className="btn-icon btn-danger"
                    onClick={() => deleteDocument(doc)}
                    title="Supprimer"
                >
                    <TrashIcon size={18} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="cerfa-manager">
            <div className="cerfa-manager-header">
                <h1>📄 Gestionnaire CERFA</h1>
                <p>Sélectionnez un template, remplissez-le, puis enregistrez-le</p>
            </div>

            {/* Section Templates */}
            <section className="cerfa-section">
                <h2>📋 Templates disponibles</h2>
                <div className="cerfa-templates-grid">
                    {CERFA_TEMPLATES.map(template => (
                        <div key={template.id} className="cerfa-template-card">
                            <div className="template-icon">
                                <FileTextIcon size={32} />
                            </div>
                            <div className="template-info">
                                <h3>{template.name}</h3>
                                <p>{template.description}</p>
                            </div>
                            <button
                                className="btn-open-template"
                                onClick={() => openTemplate(template)}
                            >
                                <ExternalLinkIcon size={18} />
                                Ouvrir le formulaire
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section Upload */}
            <section className="cerfa-section">
                <div className="section-header">
                    <h2>📤 Enregistrer un PDF rempli</h2>
                    <button
                        className="btn-upload"
                        onClick={() => setShowUploadModal(true)}
                    >
                        <PlusIcon size={18} />
                        Nouveau document
                    </button>
                </div>
            </section>

            {/* Section Documents sauvegardés */}
            <section className="cerfa-section">
                <div className="section-header">
                    <h2>📁 Documents enregistrés ({filteredDocuments.length})</h2>
                    <div className="header-actions">
                        {/* Toggle vue */}
                        <div className="view-toggle">
                            <button
                                className={`view-btn ${viewMode === 'clients' ? 'active' : ''}`}
                                onClick={() => setViewMode('clients')}
                                title="Par client"
                            >
                                <UsersIcon size={18} />
                            </button>
                            <button
                                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="Liste"
                            >
                                <ListIcon size={18} />
                            </button>
                        </div>
                        {/* Recherche */}
                        <div className="search-box">
                            <SearchIcon size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions pour la vue par client */}
                {viewMode === 'clients' && groupedByClient.length > 0 && (
                    <div className="client-actions">
                        <button className="btn-text" onClick={expandAllClients}>
                            Tout déplier
                        </button>
                        <button className="btn-text" onClick={collapseAllClients}>
                            Tout replier
                        </button>
                        <span className="client-count">
                            {groupedByClient.length} client{groupedByClient.length > 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {loading ? (
                    <div className="loading">Chargement...</div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="empty-state">
                        <FileTextIcon size={48} />
                        <p>Aucun document enregistré</p>
                    </div>
                ) : viewMode === 'clients' ? (
                    /* Vue par client */
                    <div className="cerfa-clients-list">
                        {groupedByClient.map(group => (
                            <div key={group.name} className="client-group">
                                <div
                                    className={`client-header ${expandedClients[group.name] ? 'expanded' : ''}`}
                                    onClick={() => toggleClientExpand(group.name)}
                                >
                                    <ChevronDownIcon
                                        size={20}
                                        className={`chevron ${expandedClients[group.name] ? 'rotated' : ''}`}
                                    />
                                    <div className="client-info">
                                        <h3>{group.name}</h3>
                                        <div className="client-meta">
                                            <span className="doc-count">
                                                {group.documents.length} document{group.documents.length > 1 ? 's' : ''}
                                            </span>
                                            <span className="templates-list">
                                                {Array.from(group.templates).join(', ')}
                                            </span>
                                            {group.lastDate && (
                                                <span className="last-date">
                                                    Dernier: {group.lastDate.toLocaleDateString('fr-FR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {expandedClients[group.name] && (
                                    <div className="client-documents">
                                        {group.documents.map(doc => renderDocumentCard(doc, true))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Vue liste */
                    <div className="cerfa-documents-list">
                        {filteredDocuments.map(doc => renderDocumentCard(doc))}
                    </div>
                )}
            </section>

            {/* Modal Upload */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>📤 Enregistrer un document</h2>

                        <div className="form-group">
                            <label>Numéro *</label>
                            <input
                                type="text"
                                value={uploadData.numero}
                                onChange={(e) => setUploadData(prev => ({ ...prev, numero: e.target.value }))}
                                placeholder="CERFA-0001"
                            />
                            <small>Auto-généré, modifiable si besoin</small>
                        </div>

                        <div className="form-group">
                            <label>Template utilisé</label>
                            <select
                                value={uploadData.templateName}
                                onChange={(e) => setUploadData(prev => ({ ...prev, templateName: e.target.value }))}
                            >
                                <option value="">-- Sélectionner --</option>
                                {CERFA_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Nom du client</label>
                            <input
                                type="text"
                                value={uploadData.clientName}
                                onChange={(e) => setUploadData(prev => ({ ...prev, clientName: e.target.value }))}
                                placeholder="Nom du client"
                            />
                        </div>

                        <div className="form-group">
                            <label>Date d'intervention</label>
                            <input
                                type="date"
                                value={uploadData.interventionDate}
                                onChange={(e) => setUploadData(prev => ({ ...prev, interventionDate: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                value={uploadData.notes}
                                onChange={(e) => setUploadData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Notes optionnelles..."
                                rows={3}
                            />
                        </div>

                        <div className="form-group">
                            <label>Fichier PDF *</label>
                            <div className="file-input-wrapper">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                    id="pdf-file"
                                />
                                <label htmlFor="pdf-file" className="file-input-label">
                                    <UploadIcon size={18} />
                                    {selectedFile ? selectedFile.name : 'Choisir un fichier PDF'}
                                </label>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowUploadModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                className="btn-submit"
                                onClick={handleUpload}
                                disabled={uploading || !selectedFile}
                            >
                                {uploading ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CerfaManager;
