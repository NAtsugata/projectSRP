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

const isFired = (u) => (u.employee_status || 'actif') === 'licencié';

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

const InviteModal = ({ onInvite, onCancel }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('technician');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { invitation_token, invitation_expires_at }
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const data = await onInvite(email.trim(), role);
        setLoading(false);
        if (data) setResult(data);
    };

    const inviteMessage = result
        ? `Bonjour,\nVous êtes invité à rejoindre notre espace sur le Portail SRP.\n`
          + `Créez votre compte avec CETTE adresse email : ${email}\n`
          + `Vous serez automatiquement rattaché à l'entreprise.\n`
          + `(Code d'invitation de secours : ${result.invitation_token})`
        : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteMessage);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard indisponible */
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Inviter un employé</h3>

                {!result ? (
                    <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        <div className="form-group">
                            <label>Adresse email de l'employé</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-control"
                                placeholder="employe@exemple.com"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Rôle</label>
                            <select value={role} onChange={(e) => setRole(e.target.value)} className="form-control">
                                <option value="technician">Technicien</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Administrateur</option>
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                            <button type="submit" className="btn btn-primary" disabled={loading || !email}>
                                {loading ? '…' : "Créer l'invitation"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                        <p style={{ color: '#065f46', background: '#ecfdf5', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                            ✅ Invitation créée pour <strong>{email}</strong>. L'employé n'a
                            qu'à créer son compte avec cette adresse : il sera rattaché
                            automatiquement.
                        </p>
                        <textarea readOnly value={inviteMessage} className="form-control" rows={6} style={{ fontSize: '0.8rem' }} />
                        <div className="modal-footer">
                            <button type="button" onClick={handleCopy} className="btn btn-secondary">
                                {copied ? 'Copié ✓' : 'Copier le message'}
                            </button>
                            <button type="button" onClick={onCancel} className="btn btn-primary">Terminé</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function AdminUserView({ users, onUpdateUser, onInvite, onDeactivate, onReactivate }) {
    const [editingUser, setEditingUser] = useState(null);
    const [showInvite, setShowInvite] = useState(false);
    const [permissionsUser, setPermissionsUser] = useState(null);
    const [availablePermissions, setAvailablePermissions] = useState([]);
    const [userPermissions, setUserPermissions] = useState([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const [, setPermissionsError] = useState(null);

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

    const handleDeactivateClick = useCallback((user) => {
        if (window.confirm(`Désactiver ${user.full_name || 'cet employé'} ?\n\nSon accès sera bloqué mais toutes ses données (interventions, documents, historique) seront conservées et resteront visibles.`)) {
            onDeactivate?.(user.id);
        }
    }, [onDeactivate]);

    return (
        <div className="admin-user-view">
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onSave={onUpdateUser}
                    onCancel={() => setEditingUser(null)}
                />
            )}

            {showInvite && onInvite && (
                <InviteModal
                    onInvite={onInvite}
                    onCancel={() => setShowInvite(false)}
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
                <div>
                    <h3>Gestion des Employes</h3>
                    <p className="admin-user-subtitle">
                        Gerez les comptes et les permissions de vos employes
                    </p>
                </div>
                {onInvite && (
                    <button onClick={() => setShowInvite(true)} className="btn btn-primary">
                        + Inviter un employé
                    </button>
                )}
            </div>

            <div className="card-white">
                <ul className="user-list">
                    {users.map(u => {
                        const fired = isFired(u);
                        return (
                        <li key={u.id} className={`user-item ${fired ? 'user-item-inactive' : ''}`}>
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
                                        {fired ? (
                                            <span className="user-badge badge-fired">Licencié</span>
                                        ) : (
                                            <span className="user-badge badge-active">Actif</span>
                                        )}
                                        {!u.is_admin && !fired && (
                                            <span className="user-badge badge-permissions">
                                                <ShieldIcon />
                                                Permissions
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="user-actions">
                                {!u.is_admin && !fired && (
                                    <button
                                        onClick={() => openPermissionsModal(u)}
                                        className="btn-permissions"
                                        title="Gerer les permissions"
                                    >
                                        <ShieldIcon />
                                        <span>Permissions</span>
                                    </button>
                                )}
                                {!fired && (
                                    <button
                                        onClick={() => setEditingUser(u)}
                                        className="btn-icon"
                                        title="Modifier"
                                    >
                                        <EditIcon/>
                                    </button>
                                )}
                                {onDeactivate && onReactivate && (
                                    fired ? (
                                        <button
                                            onClick={() => onReactivate(u.id)}
                                            className="btn btn-secondary btn-sm"
                                            title="Réactiver l'employé"
                                        >
                                            Réactiver
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleDeactivateClick(u)}
                                            className="btn-icon btn-icon-danger"
                                            title="Désactiver (licenciement)"
                                        >
                                            Désactiver
                                        </button>
                                    )
                                )}
                            </div>
                        </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
