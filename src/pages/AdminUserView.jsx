import React, { useState, useEffect, useCallback } from 'react';
import { EditIcon } from '../components/SharedUI';
import PermissionsModal from '../components/admin/PermissionsModal';
import { permissionService } from '../services/permissionService';
import './AdminUserView.css';

// Icone Shield pour les permissions
const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
);

const EditUserModal = ({ user, onSave, onCancel }) => {
    const [formData, setFormData] = useState(user);
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const { id, ...updates } = formData;
        await onSave(id, updates);
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
    const [permissionsUser, setPermissionsUser] = useState(null);
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [userPermissions, setUserPermissions] = useState([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const [permissionsError, setPermissionsError] = useState(null);

    // Charger les permissions disponibles au montage
    useEffect(() => {
        const loadAvailablePermissions = async () => {
            try {
                const { data, error } = await permissionService.getAvailablePermissions();
                if (error) {
                    console.error('Erreur chargement permissions:', error);
                    setPermissionsError('Les tables de permissions ne sont pas configurees. Executez la migration SQL.');
                } else if (data) {
                    setAvailablePermissions(data);
                    setPermissionsError(null);
                }
            } catch (err) {
                console.error('Erreur chargement permissions disponibles:', err);
                setPermissionsError('Erreur de connexion aux permissions.');
            }
        };
        loadAvailablePermissions();
    }, []);

    // Ouvrir le modal de permissions pour un utilisateur
    const openPermissionsModal = useCallback(async (user) => {
        setPermissionsUser(user);
        setIsLoadingPermissions(true);
        try {
            const { data, error } = await permissionService.getUserPermissions(user.id);
            if (!error && data) {
                setUserPermissions(data);
            }
        } catch (err) {
            console.error('Erreur chargement permissions utilisateur:', err);
        } finally {
            setIsLoadingPermissions(false);
        }
    }, []);

    // Sauvegarder les permissions
    const handleSavePermissions = useCallback(async (userId, permissionCodes) => {
        try {
            await permissionService.updateUserPermissions(userId, permissionCodes);
        } catch (err) {
            console.error('Erreur sauvegarde permissions:', err);
            throw err;
        }
    }, []);

    return (
        <div className="admin-user-view">
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onSave={onUpdateUser}
                    onCancel={() => setEditingUser(null)}
                />
            )}

            {permissionsUser && (
                <PermissionsModal
                    isOpen={!!permissionsUser}
                    onClose={() => setPermissionsUser(null)}
                    user={permissionsUser}
                    availablePermissions={availablePermissions}
                    userPermissions={userPermissions}
                    onSave={handleSavePermissions}
                    isLoading={isLoadingPermissions}
                />
            )}

            <div className="admin-user-header">
                <h3>Gestion des Employes</h3>
                <p className="admin-user-subtitle">
                    Gerez les comptes et les permissions de vos employes
                </p>
            </div>

            <div className="card-white">
                <ul className="user-list">
                    {users.map(u => (
                        <li key={u.id} className="user-item">
                            <div className="user-info">
                                <div className="user-avatar">
                                    {(u.full_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="user-details">
                                    <p className="user-name">{u.full_name}</p>
                                    <p className="user-email">{u.email}</p>
                                    <div className="user-badges">
                                        <span className={`user-badge ${u.is_admin ? 'badge-admin' : 'badge-standard'}`}>
                                            {u.is_admin ? 'Admin' : 'Standard'}
                                        </span>
                                        {!u.is_admin && (
                                            <span className="user-badge badge-permissions">
                                                <ShieldIcon />
                                                Permissions
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="user-actions">
                                {!u.is_admin && (
                                    <button
                                        onClick={() => openPermissionsModal(u)}
                                        className="btn-permissions"
                                        title="Gerer les permissions"
                                    >
                                        <ShieldIcon />
                                        <span>Permissions</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setEditingUser(u)}
                                    className="btn-icon"
                                    title="Modifier"
                                >
                                    <EditIcon/>
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
