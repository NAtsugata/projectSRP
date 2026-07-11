// src/pages/ChantiersView.jsx
// Suivi de chantier (MOE) : liste des chantiers + création (MOE uniquement).
// Les entreprises/employés ne voient que les chantiers où un lot leur est assigné.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chantierService } from '../services/chantierService';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner, EmptyState } from '../components/ui';
import { BuildingIcon } from '../components/SharedUI';
import { PRESET_LOTS } from '../config/chantierPresets';
import './ChantiersView.css';

const STATUS_LABELS = {
  preparation: 'Préparation',
  en_cours: 'En cours',
  receptionne: 'Réceptionné',
  clos: 'Clos',
};

const STATUS_CLASS = {
  preparation: 'chantier-status-prep',
  en_cours: 'chantier-status-active',
  receptionne: 'chantier-status-done',
  clos: 'chantier-status-closed',
};

function lotsProgress(lots = []) {
  if (!lots.length) return 0;
  return Math.round(lots.reduce((s, l) => s + (l.progress || 0), 0) / lots.length);
}

export default function ChantiersView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuthStore();
  const isAdmin = !!profile?.is_admin;

  const [chantiers, setChantiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client_name: '', address: '', start_date: '', end_date: '' });
  const [selectedLots, setSelectedLots] = useState([]);
  const [customLot, setCustomLot] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleLot = (lot) => {
    setSelectedLots((prev) => prev.includes(lot) ? prev.filter((l) => l !== lot) : [...prev, lot]);
  };
  const addCustomLot = () => {
    const v = customLot.trim();
    if (v && !selectedLots.includes(v)) setSelectedLots((prev) => [...prev, v]);
    setCustomLot('');
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await chantierService.getChantiers();
    if (error) toast?.error('Erreur de chargement des chantiers');
    setChantiers(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { id, error } = await chantierService.createChantierWithLots({
      name: form.name.trim(),
      client_name: form.client_name || null,
      address: form.address || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      lots: selectedLots,
    });
    setSaving(false);
    if (error) {
      toast?.error(`Création impossible : ${error.message}`);
      return;
    }
    toast?.success(selectedLots.length ? `Chantier créé avec ${selectedLots.length} lot(s)` : 'Chantier créé');
    setShowCreate(false);
    setForm({ name: '', client_name: '', address: '', start_date: '', end_date: '' });
    setSelectedLots([]);
    navigate(`/chantiers/${id}`);
  };

  if (loading) return <LoadingSpinner text="Chargement des chantiers..." />;

  return (
    <div className="chantiers-view">
      <div className="chantiers-header">
        <div>
          <h2>Suivi de Chantier</h2>
          <p className="chantiers-subtitle">
            {isAdmin
              ? 'Créez vos chantiers, découpez-les en lots et zones, suivez l\'avancement de chaque entreprise.'
              : 'Vos chantiers et lots assignés.'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nouveau chantier
          </button>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau chantier</h3>
            <form onSubmit={handleCreate} className="chantier-form">
              <div className="form-group">
                <label>Nom du chantier *</label>
                <input className="form-control" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex : Résidence Les Cèdres" required autoFocus />
              </div>
              <div className="form-group">
                <label>Maître d'ouvrage / client</label>
                <input className="form-control" value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Adresse</label>
                <input className="form-control" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="chantier-form-row">
                <div className="form-group">
                  <label>Début</label>
                  <input type="date" className="form-control" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Fin prévue</label>
                  <input type="date" className="form-control" value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Lots (corps de métier) — cochez ceux du chantier</label>
                <div className="preset-lots">
                  {PRESET_LOTS.map((lot) => (
                    <button type="button" key={lot}
                      className={`preset-chip ${selectedLots.includes(lot) ? 'selected' : ''}`}
                      onClick={() => toggleLot(lot)}>
                      {selectedLots.includes(lot) ? '✓ ' : '+ '}{lot}
                    </button>
                  ))}
                </div>
                <div className="inline-add" style={{ marginTop: '.5rem' }}>
                  <input className="form-control" placeholder="Autre lot…" value={customLot}
                    onChange={(e) => setCustomLot(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomLot(); } }} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomLot}>Ajouter</button>
                </div>
                {selectedLots.length > 0 && (
                  <p className="muted" style={{ marginTop: '.4rem' }}>
                    {selectedLots.length} lot(s) sélectionné(s) — vous pourrez les compléter ensuite.
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.name}>
                  {saving ? '…' : 'Créer le chantier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {chantiers.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon />}
          title="Aucun chantier"
          message={isAdmin ? 'Créez votre premier chantier pour commencer le suivi.' : 'Aucun lot ne vous est assigné pour le moment.'}
        />
      ) : (
        <div className="chantiers-grid">
          {chantiers.map((c) => {
            const prog = lotsProgress(c.chantier_lots);
            return (
              <button key={c.id} className="chantier-card" onClick={() => navigate(`/chantiers/${c.id}`)}>
                <div className="chantier-card-top">
                  <span className={`chantier-status ${STATUS_CLASS[c.status] || ''}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                  <span className="chantier-lots-count">
                    {(c.chantier_lots || []).length} lot{(c.chantier_lots || []).length > 1 ? 's' : ''}
                  </span>
                </div>
                <h3 className="chantier-card-name">{c.name}</h3>
                {c.client_name && <p className="chantier-card-client">{c.client_name}</p>}
                {c.address && <p className="chantier-card-address">📍 {c.address}</p>}
                <div className="chantier-progress">
                  <div className="chantier-progress-bar">
                    <div className="chantier-progress-fill" style={{ width: `${prog}%` }} />
                  </div>
                  <span className="chantier-progress-label">{prog}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
