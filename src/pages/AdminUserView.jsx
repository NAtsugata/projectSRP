import React, { useState, useEffect, useCallback } from 'react';
import { EditIcon } from '../components/SharedUI';
import PermissionsModal from '../components/admin/PermissionsModal';
import { permissionService } from '../services/permissionService';
import { tradesByCategory, tradeLabel, tradeColor } from '../constants/buildingTrades';
import './AdminUserView.css';

// Icone Shield pour les permissions
const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
);

// Statuts disponibles avec leur libellé et couleur badge
const EMPLOYEE_STATUSES = [
    { value: 'actif',         label: 'Actif',          color: '#10b981' },
    { value: 'inactif',       label: 'Inactif',        color: '#6b7280' },
    { value: 'licencié',      label: 'Licencié',       color: '#ef4444' },
    { value: 'retraité',      label: 'Retraité',       color: '#8b5cf6' },
    { value: 'démissionnaire',label: 'Démissionnaire', color: '#f59e0b' },
    { value: 'congé',         label: 'Congé',          color: '#3b82f6' },
];

const StatusBadge = ({ status }) => {
    const s = EMPLOYEE_STATUSES.find(x => x.value === status) || EMPLOYEE_STATUSES[0];
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: s.color + '22',
            color: s.color,
            border: `1px solid ${s.color}44`,
        }}>
            {s.label}
        </span>
    );
};

// Affiche les métiers d'un utilisateur sous forme de pastilles colorées
const TradeBadges = ({ trades }) => {
    if (!trades || trades.length === 0) return null;
    return (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
            {trades.map((code) => {
                const color = tradeColor(code);
                return (
                    <span key={code} style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: color + '22',
                        color,
                        border: `1px solid ${color}44`,
                    }}>
                        {tradeLabel(code)}
                    </span>
                );
            })}
        </span>
    );
};

// Sélecteur multi-métiers groupé par corps d'état
const TradesSelector = ({ selected, onToggle }) => {
    const groups = tradesByCategory();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
            {groups.map((group) => (
                <div key={group.id}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: group.color, marginBottom: '4px' }}>
                        {group.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {group.trades.map((t) => {
                            const isOn = selected.includes(t.code);
                            return (
                                <button
                                    type="button"
                                    key={t.code}
                                    onClick={() => onToggle(t.code)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '999px',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        border: `1px solid ${isOn ? group.color : '#d1d5db'}`,
                                        background: isOn ? group.color + '22' : 'transparent',
                                        color: isOn ? group.color : '#374151',
                                        fontWeight: isOn ? 600 : 400,
                                    }}
                                >
                                    {isOn ? '✓ ' : ''}{t.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const EditUserModal = ({ user, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        employee_status: 'actif',
        trades: [],
        ...user,
        // garantir un tableau même si la colonne est null en base
        ...(user && !Array.isArray(user.trades) ? { trades: [] } : {}),
    });
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleTrade = (code) => {
        setFormData(prev => {
            const current = Array.isArray(prev.trades) ? prev.trades : [];
            const next = current.includes(code)
                ? current.filter(c => c !== code)
                : [...current, code];
            return { ...prev, trades: next };
        });
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

                    {/* Statut RH — ne modifie PAS l'accès au coffre-fort */}
                    <div className="form-group">
                        <label>Statut</label>
                        <select name="employee_status" value={formData.employee_status || 'actif'} onChange={handleChange} className="form-control">
                            {EMPLOYEE_STATUSES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                            💡 L'employé garde l'accès à son coffre-fort quel que soit son statut.
                        </p>
                    </div>

                    {/* Métiers du bâtiment — un utilisateur peut en avoir plusieurs */}
                    <div className="form-group">
                        <label>Métiers du bâtiment</label>
                        <TradesSelector
                            selected={Array.isArray(formData.trades) ? formData.trades : []}
                            onToggle={toggleTrade}
                        />
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                            🔧 Sélectionnez un ou plusieurs métiers. Servira à filtrer le travail par corps de métier.
                        </p>
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
                                            <StatusBadge status={u.employee_status || 'actif'} />
                                        )}
                                        {!u.is_admin && (
                                            <span className="user-badge badge-permissions">
                                                <ShieldIcon />
                                                Permissions
                                            </span>
                                        )}
                                    </div>
                                    {u.trades && u.trades.length > 0 && (
                                        <div className="user-badges" style={{ marginTop: '4px' }}>
                                            <TradeBadges trades={u.trades} />
                                        </div>
                                    )}
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
