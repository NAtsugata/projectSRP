// src/pages/AdminPlanningView.js - VERSION AVEC UPLOAD FIABILISÉ
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GenericStatusBadge } from '../components/SharedUI';
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon, FileTextIcon, LoaderIcon, XIcon } from '../components/SharedUI';
import { getAssignedUsersNames } from '../utils/helpers';
import { storageService } from '../lib/supabase'; // Assurez-vous que ce chemin est correct

// La prop `onAddBriefingDocuments` est maintenant requise
export default function AdminPlanningView({ interventions, users, onAddIntervention, onArchive, onDelete, onAddBriefingDocuments }) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');

    const [formValues, setFormValues] = useState({
        client: '', address: '', service: '', date: '', time: '08:00'
    });
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [briefingFiles, setBriefingFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        setShowForm(searchParams.get('new') === 'true');
    }, [searchParams]);

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

    const openForm = () => setSearchParams({ new: 'true' });

    const closeForm = () => {
        setSearchParams({});
        setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
        setAssignedUsers([]);
        setBriefingFiles([]);
        setFormError('');
    };

    const handleFileChange = useCallback((e) => {
        setFormError('');
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setBriefingFiles(prev => {
            if (prev.length + files.length > 10) {
                setFormError("Vous ne pouvez pas ajouter plus de 10 fichiers.");
                return prev;
            }
            const newFilesWithId = files.map(file => ({
                id: `file-${Date.now()}-${Math.random()}`,
                fileObject: file
            }));
            return [...prev, ...newFilesWithId];
        });
    }, []);

    const handleRemoveFile = (fileId) => {
        setBriefingFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!onAddBriefingDocuments) {
            setFormError("Erreur de configuration : la fonction onAddBriefingDocuments est manquante.");
            return;
        }
        setIsSubmitting(true);
        setFormError('');
        let newIntervention = null;

        try {
            // Étape 1: Créer l'intervention (sans fichiers) et récupérer son ID
            newIntervention = await onAddIntervention(formValues, assignedUsers);
            if (!newIntervention || !newIntervention.id) {
                throw new Error("La création de l'intervention a échoué ou n'a pas retourné d'ID.");
            }

            // Étape 2: Envoyer les fichiers un par un en utilisant le nouvel ID
            const filesToUpload = briefingFiles.map(f => f.fileObject);
            if (filesToUpload.length > 0) {
                const successfulUploads = [];
                for (const file of filesToUpload) {
                    const result = await storageService.uploadInterventionFile(file, newIntervention.id, 'briefing');
                    if (result.error) throw result.error;

                    const urlSource = result.publicURL || result;
                    const publicUrl = urlSource.publicUrl || urlSource;
                    if (typeof publicUrl !== 'string') throw new Error("URL invalide reçue du stockage.");

                    successfulUploads.push({ name: file.name, url: publicUrl, type: file.type });
                }

                // Étape 3: Lier les fichiers envoyés à l'intervention
                if (successfulUploads.length > 0) {
                    await onAddBriefingDocuments(newIntervention.id, successfulUploads);
                }
            }

            closeForm(); // Succès, on ferme et réinitialise

        } catch (error) {
            console.error("Erreur lors du processus de création :", error);
            if (newIntervention && newIntervention.id) {
                setFormError(`L'intervention a été créée, mais l'envoi des fichiers a échoué. Modifiez-la pour les ajouter. Erreur: ${error.message}`);
            } else {
                setFormError(`Erreur de création : ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatus = (intervention) => {
        if (intervention.status === 'Terminée') return 'Terminée';
        if (intervention.report && intervention.report.arrivalTime) return 'En cours';
        return intervention.status || 'À venir';
    };

    const statusColorMap = {
        "À venir": "status-badge-blue",
        "En cours": "status-badge-yellow",
        "Terminée": "status-badge-green"
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
    };

    return (
        <div>
            <style>{`
                .file-preview-list { list-style: none; padding: 0; margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .file-preview-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; }
                .file-info { flex-grow: 1; min-width: 0; }
                .file-name { font-size: 0.9rem; font-weight: 500; word-break: break-all; }
                .file-size { font-size: 0.75rem; color: #6c757d; }
                .form-error-message { color: #dc3545; font-size: 0.875rem; margin-top: 0.5rem; background-color: #f8d7da; border: 1px solid #f5c2c7; border-radius: .25rem; padding: .75rem 1.25rem; }
            `}</style>

            <div className="flex-between mb-6">
                <h3>Gestion du Planning</h3>
                <button onClick={showForm ? closeForm : openForm} className="btn btn-primary flex-center">
                    <PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Intervention'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="card-white mb-6" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {/* Champs du formulaire */}
                    <div className="form-group"><label>Client *</label><input name="client" value={formValues.client} onChange={handleInputChange} required className="form-control" disabled={isSubmitting}/></div>
                    <div className="form-group"><label>Adresse *</label><input name="address" value={formValues.address} onChange={handleInputChange} required className="form-control" disabled={isSubmitting}/></div>
                    <div className="form-group"><label>Service *</label><input name="service" value={formValues.service} onChange={handleInputChange} required className="form-control" disabled={isSubmitting}/></div>
                    <div className="grid-2-cols">
                        <div className="form-group"><label>Date *</label><input name="date" type="date" value={formValues.date} onChange={handleInputChange} required className="form-control" disabled={isSubmitting}/></div>
                        <div className="form-group"><label>Heure *</label><input name="time" type="time" value={formValues.time} onChange={handleInputChange} required className="form-control" disabled={isSubmitting}/></div>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setDateShortcut(0)} className="btn btn-secondary" disabled={isSubmitting}>Aujourd'hui</button>
                        <button type="button" onClick={() => setDateShortcut(1)} className="btn btn-secondary" disabled={isSubmitting}>Demain</button>
                        <button type="button" onClick={() => setDateShortcut(7)} className="btn btn-secondary" disabled={isSubmitting}>Dans 1 semaine</button>
                    </div>

                    {/* Système d'upload */}
                    <div className="form-group">
                        <label>Documents de préparation (optionnel)</label>
                        <input id="briefing-file-input" type="file" multiple onChange={handleFileChange} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} disabled={isSubmitting} />
                        <button type="button" onClick={() => document.getElementById('briefing-file-input').click()} className="btn btn-secondary w-full" disabled={isSubmitting}>📎 Choisir des fichiers...</button>

                        {briefingFiles.length > 0 && (
                            <ul className="file-preview-list">
                                {briefingFiles.map(item => (
                                    <li key={item.id}>
                                        <FileTextIcon />
                                        <div className="file-info">
                                            <span className="file-name">{item.fileObject.name}</span>
                                            <span className="file-size">{formatFileSize(item.fileObject.size)}</span>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveFile(item.id)} className="btn-icon-danger" disabled={isSubmitting} title="Retirer"><XIcon /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Section d'assignation des utilisateurs */}
                    <div className="form-group">
                        <label>Assigner à :</label>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem'}}>
                            {users.filter(u => !u.is_admin).map(u => (
                                <label key={u.id} className="flex items-center gap-2" style={{cursor: isSubmitting ? 'not-allowed' : 'pointer'}}>
                                    <input type="checkbox" checked={assignedUsers.includes(u.id)} onChange={() => handleUserAssignmentChange(u.id)} disabled={isSubmitting} />
                                    <span>{u.full_name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {formError && <p className="form-error-message">{formError}</p>}

                    <button type="submit" className="btn btn-success w-full flex-center" disabled={isSubmitting}>
                        {isSubmitting ? <><LoaderIcon className="animate-spin" /> Création en cours...</> : <><PlusIcon /> Créer l'intervention</>}
                    </button>
                </form>
            )}

            {/* Liste des interventions */}
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
                                    <p className="text-muted">Assigné à: {getAssignedUsersNames(int.intervention_assignments)}</p>
                                    <p className="text-muted">{int.date} à {int.time}</p>
                                    {int.intervention_briefing_documents?.length > 0 && (
                                        <p className="text-muted" style={{fontSize: '0.875rem', marginTop: '0.25rem'}}>
                                            📎 {int.intervention_briefing_documents.length} document(s) joint(s)
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate('/planning/' + int.id)} className="btn-icon" title="Voir les détails"><EditIcon/></button>
                                    <button onClick={() => onArchive(int.id)} className="btn-icon" title="Archiver"><ArchiveIcon/></button>
                                    <button onClick={() => onDelete(int.id)} className="btn-icon-danger" title="Supprimer"><TrashIcon/></button>
                                </div>
                            </li>
                        );
                    }) : (
                        <li style={{textAlign: 'center', padding: '2rem', color: '#6c757d'}}>Aucune intervention planifiée</li>
                    )}
                </ul>
            </div>
        </div>
    );
}
