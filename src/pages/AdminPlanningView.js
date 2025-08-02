import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomFileInput, GenericStatusBadge } from '../components/SharedUI';
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon, FileTextIcon, LoaderIcon } from '../components/SharedUI';
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

    // ✅ CORRECTION PRINCIPALE : Gestion améliorée du changement de fichiers
    const handleBriefingFilesChange = (e) => {
        console.log('📁 Événement reçu:', e);

        // ✅ IMPORTANT : Vérifier si preventDefault existe avant de l'appeler
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
            e.stopPropagation();
        }

        // ✅ Gestion des fichiers depuis l'événement personnalisé de CustomFileInput
        const files = e.target?.files;

        console.log('📁 Fichiers sélectionnés:', files?.length);

        if (files && files.length > 0) {
            const newFiles = Array.from(files);
            console.log('📁 Nouveaux fichiers:', newFiles.map(f => f.name));

            setBriefingFiles(prevFiles => {
                const updatedFiles = [...prevFiles, ...newFiles];
                console.log('📁 Total fichiers:', updatedFiles.length);
                return updatedFiles;
            });
        }
    };

    const handleRemoveFile = (fileName) => {
        setBriefingFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    };

    // ✅ CORRECTION : Gestion améliorée de la soumission
    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('📝 Soumission du formulaire...');

        if (isSubmitting) {
            console.log('⚠️ Soumission déjà en cours, ignorée');
            return;
        }

        setIsSubmitting(true);

        try {
            console.log('📋 Données du formulaire:', formValues);
            console.log('👥 Utilisateurs assignés:', assignedUsers);
            console.log('📁 Fichiers de briefing:', briefingFiles.length);

            await onAddIntervention(formValues, assignedUsers, briefingFiles);

            // Reset du formulaire uniquement en cas de succès
            setShowForm(false);
            setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
            setAssignedUsers([]);
            setBriefingFiles([]);

            console.log('✅ Intervention créée avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de la création de l\'intervention:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ✅ NOUVEAU : Gestionnaire pour annuler le formulaire
    const handleCancelForm = (e) => {
        e.preventDefault();
        e.stopPropagation();

        setShowForm(false);
        setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
        setAssignedUsers([]);
        setBriefingFiles([]);
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

    return (
        <div>
            <style>{`
                .file-preview-list { list-style: none; padding: 0; margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .file-preview-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; }
                .file-preview-icon { width: 24px; height: 24px; flex-shrink: 0; color: #495057; }
                .file-preview-list li span { flex-grow: 1; font-size: 0.9rem; word-break: break-all; }
            `}</style>

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
                    <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        <input
                            name="client"
                            value={formValues.client}
                            onChange={handleInputChange}
                            placeholder="Nom du client"
                            required
                            className="form-control"
                            disabled={isSubmitting}
                        />

                        <input
                            name="address"
                            value={formValues.address}
                            onChange={handleInputChange}
                            placeholder="Adresse"
                            required
                            className="form-control"
                            disabled={isSubmitting}
                        />

                        <input
                            name="service"
                            value={formValues.service}
                            onChange={handleInputChange}
                            placeholder="Service"
                            required
                            className="form-control"
                            disabled={isSubmitting}
                        />

                        <div className="grid-2-cols">
                            <input
                                name="date"
                                type="date"
                                value={formValues.date}
                                onChange={handleInputChange}
                                required
                                className="form-control"
                                disabled={isSubmitting}
                            />
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

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDateShortcut(0)}
                                className="btn btn-secondary"
                                disabled={isSubmitting}
                            >
                                Aujourd'hui
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateShortcut(1)}
                                className="btn btn-secondary"
                                disabled={isSubmitting}
                            >
                                Demain
                            </button>
                        </div>

                        <div>
                            <label>Documents de préparation (PDF, images...)</label>
                            <CustomFileInput
                                multiple
                                onChange={handleBriefingFilesChange}
                                disabled={isSubmitting}
                                accept="image/*,application/pdf,.doc,.docx"
                                className="mt-2"
                            >
                                {isSubmitting ? 'Traitement en cours...' : 'Choisir des documents'}
                            </CustomFileInput>

                            {briefingFiles.length > 0 && (
                                <ul className="file-preview-list">
                                    {briefingFiles.map((file, index) => (
                                        <li key={`${file.name}-${index}`}>
                                            <FileTextIcon className="file-preview-icon" />
                                            <span>{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(file.name)}
                                                className="btn-icon-danger"
                                                disabled={isSubmitting}
                                                aria-label={`Supprimer ${file.name}`}
                                            >
                                                <TrashIcon width={16} height={16} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <label>Assigner à :</label>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem'}}>
                                {users.filter(u => !u.is_admin).map(u => (
                                    <label key={u.id} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={assignedUsers.includes(u.id)}
                                            onChange={() => handleUserAssignmentChange(u.id)}
                                            disabled={isSubmitting}
                                        />
                                        {u.full_name}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{display: 'flex', gap: '0.75rem', marginTop: '1rem'}}>
                            <button
                                type="button"
                                onClick={handleCancelForm}
                                className="btn btn-secondary flex-center"
                                disabled={isSubmitting}
                            >
                                Annuler
                            </button>

                            <button
                                type="submit"
                                className="btn btn-success flex-center"
                                disabled={isSubmitting}
                                style={{flex: 1}}
                            >
                                {isSubmitting && <LoaderIcon className="animate-spin" />}
                                {isSubmitting ? 'Ajout en cours...' : 'Ajouter l\'intervention'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card-white">
                <ul className="document-list">
                    {interventions.map(int => {
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
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate('/planning/' + int.id)} className="btn-icon" title="Voir les détails"><EditIcon/></button>
                                    <button onClick={() => onArchive(int.id)} className="btn-icon" title="Archiver"><ArchiveIcon/></button>
                                    <button onClick={() => onDelete(int.id)} className="btn-icon-danger" title="Supprimer"><TrashIcon/></button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}