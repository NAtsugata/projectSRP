// src/components/planning/QuickInterventionModal.jsx
// Saisie rapide d'intervention — optimisée mobile (bottom-sheet)

import { useState, useEffect, useRef, useCallback } from 'react';
import { clientService } from '../../services/clientService';
import { toLocalDateStr } from '../../utils/agendaHelpers';
import './QuickInterventionModal.css';

const today = () => toLocalDateStr(new Date());
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
};
const inTwoDays = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return toLocalDateStr(d);
};

const EMPTY_FORM = {
  client: '',
  client_phone: '',
  address: '',
  service: '',
  date: today(),
  time: '08:00',
  admin_note: ''
};

const QuickInterventionModal = ({ isOpen, onClose, onSubmit, users = [] }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [searchTimer, setSearchTimer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedUser, setAssignedUser] = useState('');
  const clientInputRef = useRef(null);
  const firstFieldRef = useRef(null);

  // Focus premier champ à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY_FORM, date: today() });
      setSelectedClientId(null);
      setSuggestions([]);
      setAssignedUser('');
      setTimeout(() => firstFieldRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Fermer avec Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // Recherche client avec debounce
  const handleClientChange = useCallback((e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, client: val, client_phone: f.client_phone, address: f.address }));
    setSelectedClientId(null);

    clearTimeout(searchTimer);
    if (val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await clientService.searchClients(val, 8);
      setSuggestions(data || []);
      setShowSuggestions(true);
    }, 250);
    setSearchTimer(timer);
  }, [searchTimer]);

  const pickClient = useCallback((client) => {
    setForm(f => ({
      ...f,
      client: client.name || client.company_name || '',
      client_phone: client.phone || client.mobile || '',
      address: [client.address, client.postal_code, client.city].filter(Boolean).join(', ')
    }));
    setSelectedClientId(client.id);
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const handleDateQuick = (dateFn) => setForm(f => ({ ...f, date: dateFn() }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client.trim() || !form.date) return;

    setIsSubmitting(true);
    try {
      const formData = {
        client: form.client.trim(),
        client_phone: form.client_phone.trim() || null,
        address: form.address.trim() || null,
        service: form.service.trim() || null,
        date: form.date,
        scheduled_dates: [form.date],
        time: form.time || '08:00',
        admin_note: form.admin_note.trim() || null,
        status: 'À venir',
        ...(selectedClientId ? { client_id: selectedClientId } : {})
      };
      const assignedUserIds = assignedUser ? [assignedUser] : [];
      await onSubmit(formData, assignedUserIds, []);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const labelDate = (d) => {
    if (d === today()) return "Aujourd'hui";
    if (d === tomorrow()) return "Demain";
    return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="qim-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Saisie rapide intervention">
      <div className="qim-sheet" onClick={e => e.stopPropagation()}>
        {/* Poignée mobile */}
        <div className="qim-handle" />

        {/* Header */}
        <div className="qim-header">
          <div className="qim-header-title">
            <span className="qim-header-icon">⚡</span>
            <span>Intervention rapide</span>
          </div>
          <button type="button" className="qim-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <form className="qim-form" onSubmit={handleSubmit} noValidate>

          {/* Client */}
          <div className="qim-field">
            <label className="qim-label" htmlFor="qim-client">Client *</label>
            <div className="qim-autocomplete-wrap" ref={clientInputRef}>
              <input
                id="qim-client"
                ref={firstFieldRef}
                type="text"
                className="qim-input"
                placeholder="Nom du client…"
                value={form.client}
                onChange={handleClientChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                autoComplete="off"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="qim-suggestions">
                  {suggestions.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="qim-suggestion-btn"
                        onMouseDown={() => pickClient(c)}
                      >
                        <span className="qim-sug-name">{c.name || c.company_name}</span>
                        {c.city && <span className="qim-sug-city">{c.city}</span>}
                        {c.phone && <span className="qim-sug-phone">{c.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Date + heure */}
          <div className="qim-row">
            <div className="qim-field qim-field--grow">
              <label className="qim-label" htmlFor="qim-date">Date *</label>
              <input
                id="qim-date"
                type="date"
                className="qim-input"
                value={form.date}
                onChange={set('date')}
                required
              />
            </div>
            <div className="qim-field qim-field--time">
              <label className="qim-label" htmlFor="qim-time">Heure</label>
              <input
                id="qim-time"
                type="time"
                className="qim-input"
                value={form.time}
                onChange={set('time')}
              />
            </div>
          </div>

          {/* Raccourcis date */}
          <div className="qim-date-shortcuts">
            {[
              { label: "Aujourd'hui", fn: today },
              { label: 'Demain', fn: tomorrow },
              { label: 'Dans 2j', fn: inTwoDays }
            ].map(({ label, fn }) => (
              <button
                key={label}
                type="button"
                className={`qim-date-chip${form.date === fn() ? ' active' : ''}`}
                onClick={() => handleDateQuick(fn)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Service */}
          <div className="qim-field">
            <label className="qim-label" htmlFor="qim-service">Type de service</label>
            <input
              id="qim-service"
              type="text"
              className="qim-input"
              placeholder="Ex: Plomberie, Électricité…"
              value={form.service}
              onChange={set('service')}
            />
          </div>

          {/* Adresse */}
          <div className="qim-field">
            <label className="qim-label" htmlFor="qim-address">Adresse</label>
            <input
              id="qim-address"
              type="text"
              className="qim-input"
              placeholder="Adresse d'intervention…"
              value={form.address}
              onChange={set('address')}
            />
          </div>

          {/* Téléphone */}
          <div className="qim-field">
            <label className="qim-label" htmlFor="qim-phone">Téléphone client</label>
            <input
              id="qim-phone"
              type="tel"
              className="qim-input"
              placeholder="06 XX XX XX XX"
              value={form.client_phone}
              onChange={set('client_phone')}
              inputMode="tel"
            />
          </div>

          {/* Employé (optionnel) */}
          {users.length > 0 && (
            <div className="qim-field">
              <label className="qim-label" htmlFor="qim-user">Assigner à</label>
              <select
                id="qim-user"
                className="qim-input qim-select"
                value={assignedUser}
                onChange={e => setAssignedUser(e.target.value)}
              >
                <option value="">— Non assigné —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div className="qim-field">
            <label className="qim-label" htmlFor="qim-note">Note rapide</label>
            <textarea
              id="qim-note"
              className="qim-input qim-textarea"
              placeholder="Infos complémentaires…"
              value={form.admin_note}
              onChange={set('admin_note')}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="qim-actions">
            <button type="button" className="qim-btn qim-btn--cancel" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="qim-btn qim-btn--submit"
              disabled={isSubmitting || !form.client.trim() || !form.date}
            >
              {isSubmitting ? (
                <span className="qim-spinner" />
              ) : (
                <>
                  <span>⚡</span>
                  {form.date === today() ? "Créer pour aujourd'hui" : `Créer pour le ${labelDate(form.date)}`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickInterventionModal;
