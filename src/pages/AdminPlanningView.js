// src/pages/AdminPlanningView.js - VERSION AMÉLIORÉE
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenericStatusBadge } from '../components/SharedUI';
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon, FileTextIcon, LoaderIcon, XIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/SharedUI';
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

    // ✅ NOUVEL ÉTAT pour gérer la file d'attente d'upload avec la progression
    const [uploadQueue, setUploadQueue] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    // ✅ Gère la sélection des fichiers et les ajoute à la file d'attente
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        const newQueueItems = files.map(file => ({
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file: file, // On garde l'objet File pour l'upload
            name: file.name,
            size: file.size,
            status: 'pending', // 'pending', 'uploading', 'completed', 'error'
            progress: 0,
            error: null,
        }));

        setUploadQueue(prev => [...prev, ...newQueueItems]);
    };

    const handleRemoveFile = (fileId) => {
        setUploadQueue(prev => prev.filter(item => item.id !== fileId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // On passe la file d'attente complète à la fonction de création
            await onAddIntervention(formValues, assignedUsers, uploadQueue);

            // Reset du formulaire après succès
            setShowForm(false);
            setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
            setAssignedUsers([]);
            setUploadQueue([]);
        } catch (error) {
            console.error("Erreur lors de la création de l'intervention:", error);
            // L'erreur est maintenant gérée dans la fonction onAddIntervention
            // pour mettre à jour le statut des fichiers dans la file d'attente.
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
            {/* Styles pour la nouvelle liste d'upload */}
            <style>{`
                .upload-queue-container { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .upload-queue-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; }
                .upload-queue-item.status-error { background-color: #fee2e2; border-color: #fecaca; }
                .file-info { flex-grow: 1; min-width: 0; }
                .file-name { font-size: 0.9rem; font-weight: 500; color: #212529; word-break: break-all; }
                .file-size { font-size: 0.75rem; color: #6c757d; }
                .upload-progress-bar { height: 4px; background-color: #e9ecef; border-radius: 2px; margin-top: 0.5rem; overflow: hidden; }
                .upload-progress-fill { height: 100%; background-color: #0d6efd; transition: width 0.3s ease; }
                .error-message { font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem; }
            `}</style>

            <div className="flex-between mb-6">
                <h3>Gestion du Planning</h3>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary flex-center">
                    <PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Intervention'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="card-white mb-6" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {/* Champs du formulaire (Client, Adresse, etc.) - Inchangés */}
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

                    {/* ✅ NOUVELLE SECTION D'UPLOAD AMÉLIORÉE */}
                    <div className="form-group">
                        <label>Documents de préparation (optionnel)</label>
                        <input
                            id="briefing-files-input"
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                            style={{ display: 'none' }}
                            disabled={isSubmitting}
                        />
                        <button
                            type="button"
                            onClick={() => document.getElementById('briefing-files-input').click()}
                            className="btn btn-secondary w-full"
                            disabled={isSubmitting}
                        >
                            📎 Choisir des fichiers...
                        </button>

                        {uploadQueue.length > 0 && (
                            <div className="upload-queue-container">
                                {uploadQueue.map(item => (
                                    <div key={item.id} className={`upload-queue-item status-${item.status}`}>
                                        <div style={{width: '24px', flexShrink: 0}}>
                                            {item.status === 'pending' && <FileTextIcon />}
                                            {item.status === 'uploading' && <LoaderIcon className="animate-spin" />}
                                            {item.status === 'completed' && <CheckCircleIcon style={{ color: '#198754' }} />}
                                            {item.status === 'error' && <AlertTriangleIcon style={{ color: '#dc3545' }} />}
                                        </div>
                                        <div className="file-info">
                                            <div className="file-name">{item.name}</div>
                                            <div className="file-size">{formatFileSize(item.size)}</div>
                                            {item.status === 'uploading' && (
                                                <div className="upload-progress-bar">
                                                    <div className="upload-progress-fill" style={{width: `${item.progress}%`}} />
                                                </div>
                                            )}
                                            {item.error && <div className="error-message">{item.error}</div>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(item.id)}
                                            className="btn-icon-danger"
                                            disabled={isSubmitting}
                                            title="Retirer"
                                        >
                                            <XIcon />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section d'assignation des utilisateurs - Inchangée */}
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

                    <button type="submit" className="btn btn-success w-full flex-center" disabled={isSubmitting}>
                        {isSubmitting ? <><LoaderIcon className="animate-spin" /> Création en cours...</> : <><PlusIcon /> Créer l'intervention</>}
                    </button>
                </form>
            )}

            {/* Liste des interventions - Inchangée */}
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
