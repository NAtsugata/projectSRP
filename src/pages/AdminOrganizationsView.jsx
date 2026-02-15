// src/pages/AdminOrganizationsView.jsx
import React, { useState } from 'react';
import { EditIcon, XIcon, CheckIcon, PlusIcon } from '../components/SharedUI';
import './AdminOrganizationsView.css';

const PLANS = ['free', 'starter', 'pro', 'enterprise'];

const INITIAL_FORM = {
    name: '',
    slug: '',
    plan: 'free',
    max_users: 5,
};

const CreateOrgModal = ({ onSave, onCancel }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: name === 'max_users' ? parseInt(value, 10) || 0 : value,
        }));
    };

    const handleSlugFromName = (e) => {
        const name = e.target.value;
        setForm(prev => ({
            ...prev,
            name,
            slug: prev.slug ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.slug.trim()) return;
        setSaving(true);
        const ok = await onSave(form);
        setSaving(false);
        if (ok) onCancel();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content org-modal">
                <h3>Nouvelle Organisation</h3>
                <form onSubmit={handleSubmit} className="org-form">
                    <div className="form-group">
                        <label>Nom</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleSlugFromName}
                            className="form-control"
                            placeholder="Mon Entreprise"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Slug (URL)</label>
                        <input
                            name="slug"
                            value={form.slug}
                            onChange={handleChange}
                            className="form-control"
                            placeholder="mon-entreprise"
                            required
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Plan</label>
                            <select name="plan" value={form.plan} onChange={handleChange} className="form-control">
                                {PLANS.map(p => (
                                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Max utilisateurs</label>
                            <input
                                name="max_users"
                                type="number"
                                min="1"
                                max="500"
                                value={form.max_users}
                                onChange={handleChange}
                                className="form-control"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Création...' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditOrgModal = ({ organization, onSave, onCancel }) => {
    const [form, setForm] = useState({
        name: organization.name || '',
        slug: organization.slug || '',
        plan: organization.plan || 'free',
        max_users: organization.max_users || 5,
    });
    const [saving, setSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: name === 'max_users' ? parseInt(value, 10) || 0 : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const ok = await onSave(organization.id, form);
        setSaving(false);
        if (ok) onCancel();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content org-modal">
                <h3>Modifier Organisation</h3>
                <form onSubmit={handleSubmit} className="org-form">
                    <div className="form-group">
                        <label>Nom</label>
                        <input name="name" value={form.name} onChange={handleChange} className="form-control" required />
                    </div>
                    <div className="form-group">
                        <label>Slug (URL)</label>
                        <input name="slug" value={form.slug} onChange={handleChange} className="form-control" required />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Plan</label>
                            <select name="plan" value={form.plan} onChange={handleChange} className="form-control">
                                {PLANS.map(p => (
                                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Max utilisateurs</label>
                            <input
                                name="max_users"
                                type="number"
                                min="1"
                                max="500"
                                value={form.max_users}
                                onChange={handleChange}
                                className="form-control"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const planBadgeClass = (plan) => {
    switch (plan) {
        case 'enterprise': return 'badge-enterprise';
        case 'pro': return 'badge-pro';
        case 'starter': return 'badge-starter';
        default: return 'badge-free';
    }
};

export default function AdminOrganizationsView({
    organizations = [],
    memberCounts = {},
    onCreateOrganization,
    onToggleActive,
    onUpdateOrganization,
}) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);

    const activeCount = organizations.filter(o => o.is_active).length;
    const totalMembers = Object.values(memberCounts).reduce((s, c) => s + c, 0);

    return (
        <div className="org-admin-container">
            <div className="org-header">
                <div>
                    <h2>Gestion des Organisations</h2>
                    <p className="org-subtitle">
                        {organizations.length} organisation{organizations.length > 1 ? 's' : ''} &middot; {activeCount} active{activeCount > 1 ? 's' : ''} &middot; {totalMembers} membre{totalMembers > 1 ? 's' : ''} total
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary org-create-btn">
                    <PlusIcon /> Nouvelle Organisation
                </button>
            </div>

            {showCreateModal && (
                <CreateOrgModal
                    onSave={onCreateOrganization}
                    onCancel={() => setShowCreateModal(false)}
                />
            )}

            {editingOrg && (
                <EditOrgModal
                    organization={editingOrg}
                    onSave={onUpdateOrganization}
                    onCancel={() => setEditingOrg(null)}
                />
            )}

            <div className="org-grid">
                {organizations.map(org => (
                    <div key={org.id} className={`org-card ${!org.is_active ? 'org-card-inactive' : ''}`}>
                        <div className="org-card-header">
                            <div className="org-card-title">
                                <h3>{org.name}</h3>
                                <span className={`org-plan-badge ${planBadgeClass(org.plan)}`}>
                                    {org.plan}
                                </span>
                            </div>
                            <div className="org-card-actions">
                                <button
                                    onClick={() => setEditingOrg(org)}
                                    className="btn-icon"
                                    title="Modifier"
                                >
                                    <EditIcon width={16} height={16} />
                                </button>
                                <button
                                    onClick={() => onToggleActive(org.id, !org.is_active)}
                                    className={`btn-icon ${org.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                                    title={org.is_active ? 'Désactiver' : 'Activer'}
                                >
                                    {org.is_active ? <XIcon /> : <CheckIcon />}
                                </button>
                            </div>
                        </div>
                        <div className="org-card-body">
                            <div className="org-card-slug">/{org.slug}</div>
                            <div className="org-card-stats">
                                <div className="org-stat">
                                    <span className="org-stat-value">{memberCounts[org.id] || 0}</span>
                                    <span className="org-stat-label">/{org.max_users} membres</span>
                                </div>
                                <div className={`org-status ${org.is_active ? 'org-status-active' : 'org-status-inactive'}`}>
                                    {org.is_active ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                        </div>
                        <div className="org-card-footer">
                            Créée le {new Date(org.created_at).toLocaleDateString('fr-FR')}
                        </div>
                    </div>
                ))}

                {organizations.length === 0 && (
                    <div className="org-empty">
                        Aucune organisation. Cliquez sur "Nouvelle Organisation" pour commencer.
                    </div>
                )}
            </div>
        </div>
    );
}
