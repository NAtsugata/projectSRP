// src/pages/AdminPlanningView.js - VERSION OPTIMISÉE POUR MOBILE
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileFileInput from '../components/MobileFileInput';
import { GenericStatusBadge } from '../components/SharedUI';
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon, FileTextIcon, LoaderIcon, XIcon } from '../components/SharedUI';
import { getAssignedUsersNames } from '../utils/helpers';

export default function AdminPlanningView({ interventions, users, onAddIntervention, onArchive, onDelete }) {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [formValues, setFormValues] = useState({ 
        client: '', 
        address: '', 
        service: '', 
        date: '', 
        time: '08:00' 
    });
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [briefingFiles, setBriefingFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadErrors, setUploadErrors] = useState([]);

    const handleInputChange = (e) => setFormValues({...formValues, [e.target.name]: e.target.value});

    const handleUserAssignmentChange = (userId) => {
        setAssignedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const setDateShortcut = (daysToAdd) => {
        const date = new Date();
        date.setDate(date.getDate() + daysToAdd);
        setFormValues(prev => ({...prev, date: date.toISOString().split('T')[0]}));
    };

    // ✅ NOUVELLE FONCTION - Gestion optimisée des fichiers
    const handleBriefingFilesChange = useCallback((e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        console.log('📎 Fichiers sélectionnés:', files.length);

        const newFiles = Array.from(files);
        setBriefingFiles(prevFiles => {
            const updated = [...prevFiles, ...newFiles];
            console.log('📋 Total fichiers briefing:', updated.length);
            return updated;
        });
        setUploadErrors([]); // Reset des erreurs
    }, []);

    // ✅ Gestion des erreurs d'upload
    const handleUploadError = useCallback((errors) => {
        setUploadErrors(errors);
        console.error('Erreurs upload:', errors);
    }, []);

    const handleRemoveFile = (fileName) => {
        setBriefingFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setUploadErrors([]);
        
        try {
            await onAddIntervention(formValues, assignedUsers, briefingFiles);
            // Reset du formulaire après succès
            setShowForm(false);
            setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
            setAssignedUsers([]);
            setBriefingFiles([]);
            setUploadErrors([]);
        } catch (error) {
            console.error("Erreur lors de la création de l'intervention:", error);
            setUploadErrors([`Erreur lors de la création: ${error.message}`]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatus = (intervention) => {
        if (intervention.status === 'Terminée') {
            return 'Terminée';
        }
        if (intervention.report && intervention.report.arrivalTime) {
            return 'En cours';
        }
        return intervention.status || 'À venir';
    };

    const statusColorMap = {
        "À venir": "status-badge-blue",
        "En cours": "status-badge-yellow",
        "Terminée": "status-badge-green"
    };

    // ✅ Fonction pour formater la taille des fichiers
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
    };

    return (
        <div>
            <style>{`
                .file-preview-list { 
                    list-style: none; 
                    padding: 0; 
                    margin-top: 1rem; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0.75rem; 
                }
                .file-preview-list li { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    padding: 0.75rem; 
                    background-color: #f8f9fa; 
                    border-radius: 0.375rem; 
                    border: 1px solid #dee2e6;
                    transition: all 0.2s ease;
                }
                .file-preview-list li:hover {
                    background-color: #e9ecef;
                    transform: translateX(2px);
                }
                .file-preview-icon { 
                    width: 24px; 
                    height: 24px; 
                    flex-shrink: 0; 
                    color: #495057; 
                }
                .file-info {
                    flex-grow: 1;
                    min-width: 0;
                }
                .file-name {
                    font-size: 0.9rem;
                    font-weight: 500;
                    word-break: break-all;
                    display: block;
                }
                .file-size {
                    font-size: 0.75rem;
                    color: #6c757d;
                    display: block;
                    margin-top: 0.25rem;
                }
                .upload-errors {
                    background-color: #fee2e2;
                    color: #b91c1c;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    margin-top: 0.5rem;
                    font-size: 0.875rem;
                }
                .upload-errors ul {
                    margin: 0;
                    padding-left: 1.25rem;
                }
                @media (max-width: 768px) {
                    .file-preview-list li {
                        padding: 0.5rem;
                    }
                    .grid-2-cols {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

            <div className="flex-between mb-6">
                <h3>Gestion du Planning</h3>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary flex-center">
                    <PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Intervention'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="card-white mb-6" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <div className="form-group">
                        <label>Client *</label>
                        <input 
                            name="client" 
                            value={formValues.client} 
                            onChange={handleInputChange} 
                            placeholder="Nom du client" 
                            required 
                            className="form-control"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="form-group">
                        <label>Adresse *</label>
                        <input 
                            name="address" 
                            value={formValues.address} 
                            onChange={handleInputChange} 
                            placeholder="Adresse complète" 
                            required 
                            className="form-control"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="form-group">
                        <label>Service *</label>
                        <input 
                            name="service" 
                            value={formValues.service} 
                            onChange={handleInputChange} 
                            placeholder="Type de service" 
                            required 
                            className="form-control"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid-2-cols">
                        <div className="form-group">
                            <label>Date *</label>
                            <input 
                                name="date" 
                                type="date" 
                                value={formValues.date} 
                                onChange={handleInputChange} 
                                required 
                                className="form-control"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="form-group">
                            <label>Heure *</label>
                            <input 
                                name="time" 
                                type="time" 
                                value={formValues.time} 
                                onChange={handleInputChange} 
                                required 
                                className="form-control"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={() => setDateShortcut(0)} className="btn btn-secondary" disabled={isSubmitting}>
                            Aujourd'hui
                        </button>
                        <button type="button" onClick={() => setDateShortcut(1)} className="btn btn-secondary" disabled={isSubmitting}>
                            Demain
                        </button>
                        <button type="button" onClick={() => setDateShortcut(7)} className="btn btn-secondary" disabled={isSubmitting}>
                            Dans 1 semaine
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Documents de préparation (optionnel)</label>
                        <MobileFileInput 
                            multiple 
                            onChange={handleBriefingFilesChange}
                            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                            maxFiles={10}
                            maxSize={10 * 1024 * 1024} // 10MB
                            disabled={isSubmitting}
                            onError={handleUploadError}
                        >
                            📎 Ajouter des documents de préparation
                        </MobileFileInput>

                        {/* Affichage des erreurs */}
                        {uploadErrors.length > 0 && (
                            <div className="upload-errors">
                                <strong>Erreurs détectées :</strong>
                                <ul>
                                    {uploadErrors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Liste des fichiers sélectionnés */}
                        {briefingFiles.length > 0 && (
                            <ul className="file-preview-list">
                                {briefingFiles.map((file, index) => (
                                    <li key={`${file.name}-${index}`}>
                                        <FileTextIcon className="file-preview-icon" />
                                        <div className="file-info">
                                            <span className="file-name">{file.name}</span>
                                            <span className="file-size">{formatFileSize(file.size)}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveFile(file.name)} 
                                            className="btn-icon-danger"
                                            disabled={isSubmitting}
                                            title="Retirer"
                                        >
                                            <XIcon />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Assigner à :</label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                            gap: '0.5rem',
                            marginTop: '0.5rem'
                        }}>
                            {users.filter(u => !u.is_admin).map(u => (
                                <label key={u.id} className="flex items-center gap-2" style={{cursor: isSubmitting ? 'not-allowed' : 'pointer'}}>
                                    <input
                                        type="checkbox"
                                        checked={assignedUsers.includes(u.id)}
                                        onChange={() => handleUserAssignmentChange(u.id)}
                                        disabled={isSubmitting}
                                    />
                                    <span>{u.full_name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn btn-success w-full flex-center" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <LoaderIcon className="animate-spin" />
                                Création en cours...
                            </>
                        ) : (
                            <>
                                <PlusIcon />
                                Créer l'intervention
                            </>
                        )}
                    </button>
                </form>
            )}

            <div className="card-white">
                <h4 style={{marginBottom: '1rem'}}>Interventions planifiées</h4>
                <ul className="document-list">
                    {interventions.length > 0 ? interventions.map(int => {
                        const status = getStatus(int);
                        return (
                            <li key={int.id}>
                                <div style={{flexGrow: 1}}>
                                    <div className="flex-between items-start">
                                        <p className="font-semibold">{int.client} - {int.service}</p>
                                        <GenericStatusBadge status={status} colorMap={statusColorMap} />
                                    </div>
                                    <p className="text-muted">
                                        Assigné à: {getAssignedUsersNames(int.intervention_assignments)}
                                    </p>
                                    <p className="text-muted">{int.date} à {int.time}</p>
                                    {int.intervention_briefing_documents?.length > 0 && (
                                        <p className="text-muted" style={{fontSize: '0.875rem', marginTop: '0.25rem'}}>
                                            📎 {int.intervention_briefing_documents.length} document(s) joint(s)
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => navigate('/planning/' + int.id)} 
                                        className="btn-icon" 
                                        title="Voir les détails"
                                    >
                                        <EditIcon/>
                                    </button>
                                    <button 
                                        onClick={() => onArchive(int.id)} 
                                        className="btn-icon" 
                                        title="Archiver"
                                    >
                                        <ArchiveIcon/>
                                    </button>
                                    <button 
                                        onClick={() => onDelete(int.id)} 
                                        className="btn-icon-danger" 
                                        title="Supprimer"
                                    >
                                        <TrashIcon/>
                                    </button>
                                </div>
                            </li>
                        );
                    }) : (
                        <li style={{textAlign: 'center', padding: '2rem', color: '#6c757d'}}>
                            Aucune intervention planifiée
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}