import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomFileInput } from '../components/SharedUI';
// MODIFIÉ: Ajout des icônes nécessaires
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon, FileTextIcon, LoaderIcon } from '../components/SharedUI';
import { getAssignedUsersNames } from '../utils/helpers';

export default function AdminPlanningView({ interventions, users, onAddIntervention, onArchive, onDelete }) {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [formValues, setFormValues] = useState({ client: '', address: '', service: '', date: '', time: '08:00' });
    const [assignedUsers, setAssignedUsers] = useState([]);
    // MODIFIÉ: L'état stocke maintenant un tableau de fichiers
    const [briefingFiles, setBriefingFiles] = useState([]);
    // AJOUT: Un état pour suivre l'envoi du formulaire
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

    // MODIFIÉ: La fonction convertit la FileList en tableau pour l'affichage
    const handleBriefingFilesChange = (e) => {
        const newFiles = Array.from(e.target.files);
        setBriefingFiles(prevFiles => [...prevFiles, ...newFiles]);
    };

    // AJOUT: Fonction pour retirer un fichier de la liste
    const handleRemoveFile = (fileName) => {
        setBriefingFiles(prevFiles => prevFiles.filter(file => file.name !== fileName));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true); // Active l'état de chargement
        try {
            await onAddIntervention(formValues, assignedUsers, briefingFiles);
            // Réinitialisation seulement après le succès
            setShowForm(false);
            setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
            setAssignedUsers([]);
            setBriefingFiles([]);
        } catch (error) {
            // L'erreur est déjà gérée dans App.js avec un toast, on peut la logger ici si besoin
            console.error("Erreur lors de la création de l'intervention:", error);
        } finally {
            setIsSubmitting(false); // Désactive l'état de chargement
        }
    };

    return (
        <div>
            {/* Styles pour la nouvelle liste de fichiers */}
            <style>{`
                .file-preview-list { list-style: none; padding: 0; margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .file-preview-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; }
                .file-preview-icon { width: 24px; height: 24px; flex-shrink: 0; color: #495057; }
                .file-preview-list li span { flex-grow: 1; font-size: 0.9rem; word-break: break-all; }
            `}</style>

            <div className="flex-between mb-6">
                <h3>Gestion du Planning</h3>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary flex-center">
                    <PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Intervention'}
                </button>
            </div>
            {showForm && (
                <form onSubmit={handleSubmit} className="card-white mb-6" style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <input name="client" value={formValues.client} onChange={handleInputChange} placeholder="Nom du client" required className="form-control"/>
                    <input name="address" value={formValues.address} onChange={handleInputChange} placeholder="Adresse" required className="form-control"/>
                    <input name="service" value={formValues.service} onChange={handleInputChange} placeholder="Service" required className="form-control"/>
                    <div className="grid-2-cols">
                        <input name="date" type="date" value={formValues.date} onChange={handleInputChange} required className="form-control"/>
                        <input name="time" type="time" value={formValues.time} onChange={handleInputChange} required className="form-control"/>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setDateShortcut(0)} className="btn btn-secondary">Aujourd'hui</button>
                        <button type="button" onClick={() => setDateShortcut(1)} className="btn btn-secondary">Demain</button>
                    </div>
                    <div>
                        <label>Documents de préparation (PDF, images...)</label>
                        <CustomFileInput multiple onChange={handleBriefingFilesChange} className="mt-2">
                            Choisir des documents
                        </CustomFileInput>
                        {/* AJOUT: Affichage des fichiers sélectionnés */}
                        {briefingFiles.length > 0 && (
                            <ul className="file-preview-list">
                                {briefingFiles.map((file, index) => (
                                    <li key={index}>
                                        <FileTextIcon className="file-preview-icon" />
                                        <span>{file.name}</span>
                                        <button type="button" onClick={() => handleRemoveFile(file.name)} className="btn-icon-danger">
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
                                    <input type="checkbox" checked={assignedUsers.includes(u.id)} onChange={() => handleUserAssignmentChange(u.id)} />
                                    {u.full_name}
                                </label>
                            ))}
                        </div>
                    </div>
                    {/* MODIFIÉ: Le bouton est désactivé pendant l'envoi */}
                    <button type="submit" className="btn btn-success w-full flex-center" disabled={isSubmitting}>
                        {isSubmitting && <LoaderIcon className="animate-spin" />}
                        {isSubmitting ? 'Ajout en cours...' : 'Ajouter l\'intervention'}
                    </button>
                </form>
            )}
            <div className="card-white">
                <ul className="document-list">
                    {interventions.map(int => (
                        <li key={int.id}>
                            <div style={{flexGrow: 1}}>
                                <p className="font-semibold">{int.client} - {int.service}</p>
                                <p className="text-muted">Assigné à: {getAssignedUsersNames(int.intervention_assignments)}</p>
                                <p className="text-muted">{int.date} à {int.time}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => navigate('/planning/' + int.id)} className="btn-icon" title="Voir les détails"><EditIcon/></button>
                                <button onClick={() => onArchive(int.id)} className="btn-icon" title="Archiver"><ArchiveIcon/></button>
                                <button onClick={() => onDelete(int.id)} className="btn-icon-danger" title="Supprimer"><TrashIcon/></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
