import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import SignaturePad from './SignaturePad';
import { Button } from './ui';
import logger from '../utils/logger';

export default function ReceptionForm({ intervention, organization, technician, onSaved, onClose }) {
  const defaultReport = intervention?.report || {};

  const [report, setReport] = useState({
    notes: defaultReport.notes || '',
    arrivalTime: defaultReport.arrivalTime || '',
    departureTime: defaultReport.departureTime || '',
    checkpoints: defaultReport.quick_checkpoints || [
      { label: 'Zone sécurisée', done: false },
      { label: 'Essais OK', done: false },
      { label: 'Brief client fait', done: false }
    ],
    parts_used: defaultReport.parts_used || '',
    rating: defaultReport.rating || 0,
    signature: defaultReport.signature || null
  });

  const [kmStart, setKmStart] = useState(intervention?.km_start || '');
  const [kmEnd, setKmEnd] = useState(defaultReport.km_end || '');
  const [isSaving, setIsSaving] = useState(false);

  const kmIndemnity = (kmStart && kmEnd && Number(kmEnd) > Number(kmStart))
    ? ((Number(kmEnd) - Number(kmStart)) * 0.5).toFixed(2)
    : null;

  const handleNow = (field) => {
    setReport(prev => ({ ...prev, [field]: new Date().toISOString() }));
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); }
    catch { return '—'; }
  };

  const saveForm = async (signAndComplete = false) => {
    if (signAndComplete && !report.signature) {
      alert('Veuillez faire signer le client avant de valider.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...defaultReport,
        ...report,
        quick_checkpoints: report.checkpoints,
        km_end: kmEnd ? Number(kmEnd) : null
      };
      const updates = {
        report: payload,
        km_start: kmStart ? Number(kmStart) : intervention?.km_start,
        km_end: kmEnd ? Number(kmEnd) : null,
        is_signed: signAndComplete,
      };
      if (signAndComplete) {
        updates.signed_at = new Date().toISOString();
        updates.status = 'Terminée';
      }
      const { error } = await supabase
        .from('interventions')
        .update(updates)
        .eq('id', intervention.id);
      if (error) throw error;
      if (onSaved) onSaved();
    } catch (e) {
      logger.error('Erreur sauvegarde réception:', e);
      alert('Erreur lors de la sauvegarde : ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle = {
    background: 'var(--card-bg, #fff)',
    borderRadius: '10px',
    border: '1px solid var(--border-color, #e2e8f0)',
    padding: '16px',
    marginBottom: '16px'
  };

  const h4Style = {
    margin: '0 0 12px 0',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary, #1e293b)',
    borderBottom: '1px solid var(--border-color, #e2e8f0)',
    paddingBottom: '8px'
  };

  return (
    <div style={{ padding: '16px', maxWidth: '800px', margin: '0 auto' }}>
      {/* En-tête entreprise */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          {organization?.logo_url && (
            <img src={organization.logo_url} alt="Logo" style={{ height: '48px', marginBottom: '8px', display: 'block' }} />
          )}
          <strong style={{ fontSize: '1.1rem' }}>{organization?.name || 'Entreprise'}</strong>
          {organization?.siret && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>SIRET : {organization.siret}</div>}
          {organization?.address && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>{organization.address}</div>}
          {organization?.phone && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>{organization.phone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>PV de Réception</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>N° {String(intervention?.id || '').substring(0, 8).toUpperCase()}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>Technicien : {technician?.full_name || '—'}</div>
        </div>
      </div>

      {/* Infos intervention */}
      <div style={cardStyle}>
        <h4 style={h4Style}>📋 Informations intervention</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.9rem' }}>
          <div><strong>Client :</strong> {intervention?.client || intervention?.client_data?.name || '—'}</div>
          <div><strong>Téléphone :</strong> {intervention?.client_phone || '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Adresse :</strong> {intervention?.address || '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Service :</strong> {intervention?.service || '—'}</div>
        </div>
      </div>

      {/* Horaires */}
      <div style={cardStyle}>
        <h4 style={h4Style}>⏱️ Horaires</h4>
        {[['arrivalTime', 'Arrivée'], ['departureTime', 'Départ']].map(([field, label]) => (
          <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ width: '70px', fontSize: '0.9rem', fontWeight: 500 }}>{label} :</span>
            <input
              type="text"
              readOnly
              value={fmtTime(report[field])}
              className="form-control"
              style={{ flex: 1, minWidth: '150px', background: 'var(--input-bg, #f8fafc)' }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => handleNow(field)}>
              Maintenant
            </Button>
          </div>
        ))}
      </div>

      {/* Kilométrage */}
      <div style={cardStyle}>
        <h4 style={h4Style}>🚗 Kilométrage</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          {[['kmStart', setKmStart, 'Départ', kmStart], ['kmEnd', setKmEnd, 'Arrivée', kmEnd]].map(([key, setter, label, val]) => (
            <div key={key} style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>{label}</label>
              <input type="number" className="form-control" value={val} onChange={e => setter(e.target.value)} />
            </div>
          ))}
          {kmIndemnity && (
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Indemnité (est.)</label>
              <input type="text" className="form-control" readOnly value={`${kmIndemnity} €`} style={{ background: 'var(--input-bg, #f0fdf4)', color: '#166534', fontWeight: 600 }} />
            </div>
          )}
        </div>
      </div>

      {/* Checkpoints */}
      <div style={cardStyle}>
        <h4 style={h4Style}>✅ Checkpoints</h4>
        <div style={{ display: 'grid', gap: '8px' }}>
          {report.checkpoints.map((cp, idx) => (
            <label key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
              padding: '10px 12px',
              background: cp.done ? 'var(--success-bg, #ecfdf5)' : 'var(--input-bg, #f8fafc)',
              borderRadius: '6px',
              border: `1px solid ${cp.done ? '#10b981' : 'var(--border-color, #e2e8f0)'}`,
              transition: 'all 0.2s'
            }}>
              <input
                type="checkbox"
                checked={cp.done}
                onChange={e => {
                  const newCp = [...report.checkpoints];
                  newCp[idx] = { ...newCp[idx], done: e.target.checked };
                  setReport(prev => ({ ...prev, checkpoints: newCp }));
                }}
                style={{ width: '1.2rem', height: '1.2rem', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: cp.done ? 500 : 'normal', color: cp.done ? '#065f46' : 'var(--text-primary, #334155)' }}>
                {cp.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Pièces utilisées */}
      <div style={cardStyle}>
        <h4 style={h4Style}>🔧 Pièces utilisées</h4>
        <textarea
          className="form-control"
          rows="3"
          placeholder="Ex : 2x Filtres, 1x Pompe, 3m Tuyau..."
          value={report.parts_used}
          onChange={e => setReport(prev => ({ ...prev, parts_used: e.target.value }))}
        />
      </div>

      {/* Notes */}
      <div style={cardStyle}>
        <h4 style={h4Style}>📝 Notes / Observations</h4>
        <textarea
          className="form-control"
          rows="4"
          placeholder="Observations sur l'intervention, travaux réalisés..."
          value={report.notes}
          onChange={e => setReport(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>

      {/* Satisfaction */}
      <div style={cardStyle}>
        <h4 style={h4Style}>⭐ Satisfaction client</h4>
        <div style={{ display: 'flex', gap: '8px', fontSize: '2rem' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <span
              key={star}
              onClick={() => setReport(prev => ({ ...prev, rating: star }))}
              style={{ cursor: 'pointer', color: star <= report.rating ? '#fbbf24' : 'var(--border-color, #cbd5e1)', transition: 'color 0.2s', lineHeight: 1 }}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div style={cardStyle}>
        <h4 style={h4Style}>✍️ Signature client</h4>
        <SignaturePad
          initialValue={report.signature}
          onSave={sig => setReport(prev => ({ ...prev, signature: sig }))}
          onClear={() => setReport(prev => ({ ...prev, signature: null }))}
          width={400}
          height={200}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
        {onClose && <Button type="button" variant="ghost" onClick={onClose}>Fermer</Button>}
        <Button type="button" variant="secondary" onClick={() => saveForm(false)} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : '💾 Enregistrer'}
        </Button>
        <Button type="button" variant="primary" onClick={() => saveForm(true)} disabled={isSaving}>
          {isSaving ? 'Validation...' : '✅ Valider & Signer'}
        </Button>
      </div>
    </div>
  );
}
