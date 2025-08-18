import React, { useState } from 'react';
import { EditIcon } from '../components/SharedUI';

const EditUserModal = ({ user, onSave, onCancel }) => {
    const [formData, setFormData] = useState(user);
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // On rend la fonction asynchrone pour une meilleure gestion
    const handleSave = async (e) => {
        e.preventDefault();
        await onSave(formData); // On attend que la sauvegarde soit tentée
        onCancel();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Modifier le compte</h3>
                <form onSubmit={handleSave} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    <div className="form-group">
                        <label>Nom complet</label>
                        <input name="full_name" value={formData.full_name || ''} onChange={handleChange} className="form-control"/>
                    </div>
                    <div className="form-group">
                        <label>
                            <input name="is_admin" type="checkbox" checked={!!formData.is_admin} onChange={handleChange} />
                            <span style={{marginLeft: '0.5rem'}}>Administrateur</span>
                        </label>
                    </div>
                    <div className="modal-footer">
                        <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                        <button type="submit" className="btn btn-primary">Sauvegarder</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AdminUserView({ users, onUpdateUser }) {
    const [editingUser, setEditingUser] = useState(null);
    return (
        <div>
            {editingUser && <EditUserModal user={editingUser} onSave={onUpdateUser} onCancel={() => setEditingUser(null)} />}
            <h3>Gestion des Employés</h3>
            <div className="card-white">
                <ul className="document-list">
                    {users.map(u => (
                        <li key={u.id}>
                            <div>
                                <p className="font-semibold">{u.full_name}</p>
                                <p className="text-muted">{u.email}</p>
                            </div>
                            <button onClick={() => setEditingUser(u)} className="btn-icon"><EditIcon/></button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
