// =============================
// FILE: src/pages/CerfaManager.js
// Gestionnaire de PDF CERFA
// =============================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import {
    FileTextIcon, DownloadIcon, UploadIcon,
    TrashIcon, ExternalLinkIcon, SearchIcon,
    PlusIcon, EditIcon
} from '../components/SharedUI';
import './CerfaManager.css';

// Templates CERFA disponibles
const CERFA_TEMPLATES = [
    {
        id: 'cerfa_15497-04',
        name: 'CERFA 15497-04',
        description: 'Fiche d\'intervention - Fluides frigorigènes',
        path: '/cerfa-form',  // Formulaire HTML mobile-friendly
        pdfPath: '/cerfa/cerfa_15497-04.pdf'  // PDF pour référence
    },
    // Ajouter d'autres templates ici
];

function CerfaManager() {
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
            console.error('Erreur chargement documents:', error);
            toast.error('Erreur lors du chargement des documents');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Obtenir le prochain numéro
    const getNextNumero = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_next_cerfa_numero');
            if (error) {
                // Fallback: compter les documents existants
                const count = documents.length + 1;
                return `CERFA-${String(count).padStart(4, '0')}`;
            }
            return data;
        } catch {
            const count = documents.length + 1;
            return `CERFA-${String(count).padStart(4, '0')}`;
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

    // Ouvrir un template PDF
    const openTemplate = (template) => {
        window.open(template.path, '_blank');
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
            console.error('Erreur upload:', error);
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
            console.error('Erreur téléchargement:', error);
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

    // Filtrer les documents
    const filteredDocuments = documents.filter(doc =>
        doc.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.client_name && doc.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
                                Ouvrir le PDF
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
                    <h2>📁 Documents enregistrés</h2>
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

                {loading ? (
                    <div className="loading">Chargement...</div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="empty-state">
                        <FileTextIcon size={48} />
                        <p>Aucun document enregistré</p>
                    </div>
                ) : (
                    <div className="cerfa-documents-list">
                        {filteredDocuments.map(doc => (
                            <div key={doc.id} className="cerfa-document-card">
                                <div className="doc-icon">
                                    <FileTextIcon size={24} />
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
                                    <p>{doc.client_name || 'Client non spécifié'}</p>
                                    <span className="doc-date">
                                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
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
                        ))}
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
