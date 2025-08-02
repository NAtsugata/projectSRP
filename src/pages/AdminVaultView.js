// ✅ VERSION CORRIGÉE POUR MOBILE
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUploader from '../components/FileUploader';
import { GenericStatusBadge, PlusIcon, EditIcon, ArchiveIcon, TrashIcon } from '../components/SharedUI';
import { getAssignedUsersNames } from '../utils/helpers';

export default function AdminPlanningView({ interventions, users, onAddIntervention, onArchive, onDelete }) {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [formValues, setFormValues] = useState({ client: '', address: '', service: '', date: '', time: '08:00' });
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [briefingFiles, setBriefingFiles] = useState([]);
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

    const handleBriefingFilesUpload = (urls) => {
        const uploadedFiles = urls.map((url, i) => ({ name: `Fichier_${i + 1}`, url }));
        setBriefingFiles(prev => [...prev, ...uploadedFiles]);
    };

    const handleRemoveFile = (fileUrl) => {
        setBriefingFiles(prevFiles => prevFiles.filter(file => file.url !== fileUrl));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onAddIntervention(formValues, assignedUsers, briefingFiles);
            setShowForm(false);
            setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
            setAssignedUsers([]);
            setBriefingFiles([]);
        } catch (error) {
            console.error('Erreur création intervention:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelForm = (e) => {
        e.preventDefault();
        setShowForm(false);
        setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
        setAssignedUsers([]);
        setBriefingFiles([]);
    };

    const getStatus = (intervention) => {
        if (intervention.status === 'Terminée') return 'Terminée';
        if (intervention.report?.arrivalTime) return 'En cours';
        return intervention.status || 'À venir';
    };

    const statusColorMap = {
        'À venir': 'status-badge-blue',
        'En cours': 'status-badge-yellow',
        'Terminée': 'status-badge-green'
    };

    return (
        <div>
            <div className="flex-between mb-6">
                <h3>Gestion du Planning</h3>
                <button
                    type="button"
                    onClick={() => setShowForm(!showForm)}
                    className="btn btn-primary flex-center"
                    disabled={isSubmitting}
                >
                    <PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Intervention'}
                </button>
            </div>

            {showForm && (
                <div className="card-white mb-6">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <input name="client" value={formValues.client} onChange={handleInputChange} placeholder="Nom du client" className="form-control" required disabled={isSubmitting} />
                        <input name="address" value={formValues.address} onChange={handleInputChange} placeholder="Adresse" className="form-control" required disabled={isSubmitting} />
                        <input name="service" value={formValues.service} onChange={handleInputChange} placeholder="Service" className="form-control" required disabled={isSubmitting} />

                        <div className="grid-2-cols">
                            <input name="date" type="date" value={formValues.date} onChange={handleInputChange} className="form-control" required disabled={isSubmitting} />
                            <input name="time" type="time" value={formValues.time} onChange={handleInputChange} className="form-control" required disabled={isSubmitting} />
                        </div>

                        <div className="flex gap-2">
                            <button type="button" onClick={() => setDateShortcut(0)} className="btn btn-secondary" disabled={isSubmitting}>Aujourd'hui</button>
                            <button type="button" onClick={() => setDateShortcut(1)} className="btn btn-secondary" disabled={isSubmitting}>Demain</button>
                        </div>

                        <div>
                            <label>Documents de préparation (PDF, images...)</label>
                            <FileUploader
                                multiple
                                onUploadComplete={handleBriefingFilesUpload}
                                disabled={isSubmitting}
                            />
                            <ul className="file-preview-list">
                                {briefingFiles.map(file => (
                                    <li key={file.url}>
                                        <span>{file.name}</span>
                                        <button onClick={() => handleRemoveFile(file.url)} type="button" className="btn btn-danger">Supprimer</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-4 justify-end">
                            <button onClick={handleCancelForm} type="button" className="btn btn-secondary">Annuler</button>
                            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>Créer l'intervention</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="intervention-list">
                {interventions.map(int => (
                    <div key={int.id} className="card-white mb-3">
                        <div className="flex-between">
                            <div>
                                <p className="font-semibold">{int.client}</p>
                                <p className="text-muted">{int.service}</p>
                                <p className="text-muted">{int.date} à {int.time}</p>
                            </div>
                            <GenericStatusBadge status={getStatus(int)} colorMap={statusColorMap}/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
