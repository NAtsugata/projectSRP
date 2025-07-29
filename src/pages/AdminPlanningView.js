import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomFileInput } from '../components/SharedUI';
import { PlusIcon, EditIcon, ArchiveIcon, TrashIcon } from '../components/SharedUI';

export default function AdminPlanningView({ interventions, users, onAddIntervention, onArchive, onDelete }) {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(false);
    const [formValues, setFormValues] = useState({ client: '', address: '', service: '', date: '', time: '08:00' });
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [briefingFiles, setBriefingFiles] = useState([]);
    
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
    
    const handleBriefingFilesChange = (e) => {
        setBriefingFiles(e.target.files);
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onAddIntervention(formValues, assignedUsers, Array.from(briefingFiles));
        setShowForm(false);
        setFormValues({ client: '', address: '', service: '', date: '', time: '08:00' });
        setAssignedUsers([]);
        setBriefingFiles([]);
    };

    return (
        <div>
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
                    </div>
                    <div>
                        <label>Assigner à :</label>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem'}}>
                            {users.filter(u => !u.is_admin).map(u => (
                                <label key={u.id} className="flex items-center gap-2">
                                    <input type="checkbox" checked={assignedUsers.includes(u.id)} onChange={() => handleUserAssignmentChange(u.id)} />
                                    {u.full_name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="btn btn-success w-full">Ajouter</button>
                </form>
            )}
            <div className="card-white">
                <ul className="document-list">
                    {interventions.map(int => (
                        <li key={int.id}>
                            <div style={{flexGrow: 1}}>
                                <p className="font-semibold">{int.client} - {int.service}</p>
                                <p className="text-muted">Assigné à: {int.intervention_assignments.map(a => a.profiles.full_name).join(', ') || 'Personne'}</p>
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
