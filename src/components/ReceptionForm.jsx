import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import SignaturePad from './SignaturePad';
import { Button } from './ui';
import logger from '../utils/logger';

export default function ReceptionForm({ intervention, organization, technician, onSaved, onClose }) {
  const defaultReport = intervention.report || {};
  
  const [report, setReport] = useState({
    notes: defaultReport.notes || '',
    arrivalTime: defaultReport.arrivalTime || '',
    departureTime: defaultReport.departureTime || '',
    checkpoints: defaultReport.quick_checkpoints || defaultReport.checkpoints || [
      { label: 'Zone sécurisée', done: false },
      { label: 'Essais OK', done: false },
      { label: 'Brief client fait', done: false }
    ],
    parts_used: defaultReport.parts_used || '',
    rating: defaultReport.rating || 0,
    signature: defaultReport.signature || null
  });

  const [kmStart, setKmStart] = useState(intervention.km_start || '');
  const [kmEnd, setKmEnd] = useState(intervention.report?.km_end || '');
  const [isSaving, setIsSaving] = useState(false);

  // Computed
  const kmIndemnity = (kmStart && kmEnd && kmEnd > kmStart) ? (kmEnd - kmStart) * 0.5 : 0;

  const handleNow = (field) => {
    setReport(prev => ({ ...prev, [field]: new Date().toISOString() }));
  };

  const saveForm = async (signAndComplete = false) => {
    if (signAndComplete && !report.signature) {
      alert("Veuillez faire signer le client avant de valider.");
      return;
    }
    
    setIsSaving(true);
    try {
      // Map back to expected properties if needed
      const payload = { 
        ...defaultReport,
        ...report, 
        quick_checkpoints: report.checkpoints,
        km_end: kmEnd 
      };
      
      const updates = {
        report: payload,
        km_start: kmStart,
        km_end: kmEnd,
        is_signed: signAndComplete,
        status: signAndComplete ? 'Terminée' : intervention.status
      };
      
      if (signAndComplete) {
        updates.signed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('interventions')
        .update(updates)
        .eq('id', intervention.id);

      if (error) throw error;
      
      if (onSaved) onSaved();
    } catch (e) {
      logger.error("Erreur sauvegarde réception:", e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="reception-form" style={{ padding: '20px', background: '#fff', borderRadius: '8px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
        <div>
          {organization?.logo_url && <img src={organization.logo_url} alt="Logo" style={{ height: '50px', marginBottom: '10px' }} />}
          <h3 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>{organization?.name || 'Entreprise'}</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>SIRET: {organization?.siret || 'N/A'}</p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{organization?.address}</p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{organization?.phone}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>PV de Réception</h2>
          <p style={{ margin: '0 0 5px 0' }}><strong>Intervention N° {intervention.id.substring(0, 8)}</strong></p>
          <p style={{ margin: 0, color: '#475569' }}>Technicien: {technician?.full_name || 'Non assigné'}</p>
        </div>
      </div>

      <div style={{ marginBottom: '25px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>Client & Intervention</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <p style={{ margin: 0 }}><strong>Client:</strong> {intervention.client || intervention.client_data?.name}</p>
          <p style={{ margin: 0 }}><strong>Téléphone:</strong> {intervention.client_phone}</p>
          <p style={{ margin: 0, gridColumn: '1 / -1' }}><strong>Adresse:</strong> {intervention.address}</p>
          <p style={{ margin: 0, gridColumn: '1 / -1' }}><strong>Service:</strong> {intervention.service}</p>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Horaires</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ width: '80px' }}>Arrivée:</label>
          <input type="text" readOnly value={report.arrivalTime ? new Date(report.arrivalTime).toLocaleString('fr-FR') : ''} className="form-control" style={{ flex: 1 }} />
          <Button type="button" onClick={() => handleNow('arrivalTime')} variant="secondary" size="sm">Maintenant</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
          <label style={{ width: '80px' }}>Départ:</label>
          <input type="text" readOnly value={report.departureTime ? new Date(report.departureTime).toLocaleString('fr-FR') : ''} className="form-control" style={{ flex: 1 }} />
          <Button type="button" onClick={() => handleNow('departureTime')} variant="secondary" size="sm">Maintenant</Button>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Kilométrage</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#475569' }}>Départ</label>
            <input type="number" className="form-control" value={kmStart} onChange={e => setKmStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#475569' }}>Arrivée</label>
            <input type="number" className="form-control" value={kmEnd} onChange={e => setKmEnd(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#475569' }}>Indemnité (est.)</label>
            <input type="text" className="form-control" readOnly value={`${kmIndemnity.toFixed(2)} €`} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Checkpoints</h4>
        <div style={{ display: 'grid', gap: '10px' }}>
          {report.checkpoints.map((cp, idx) => (
            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', background: cp.done ? '#ecfdf5' : '#f8fafc', borderRadius: '6px', border: `1px solid ${cp.done ? '#10b981' : '#e2e8f0'}` }}>
              <input 
                type="checkbox" 
                checked={cp.done} 
                onChange={e => {
                  const newCp = [...report.checkpoints];
                  newCp[idx].done = e.target.checked;
                  setReport(prev => ({...prev, checkpoints: newCp}));
                }} 
                style={{ width: '1.2rem', height: '1.2rem', accentColor: '#10b981' }}
              />
              <span style={{ color: cp.done ? '#065f46' : '#334155', fontWeight: cp.done ? '500' : 'normal' }}>{cp.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Pièces utilisées</h4>
        <textarea 
          className="form-control" 
          rows="3" 
          placeholder="Ex: 2x Filtres, 1x Pompe..."
          value={report.parts_used}
          onChange={e => setReport(prev => ({...prev, parts_used: e.target.value}))}
        />
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Notes / Observations</h4>
        <textarea 
          className="form-control" 
          rows="4"
          placeholder="Observations sur l'intervention..."
          value={report.notes}
          onChange={e => setReport(prev => ({...prev, notes: e.target.value}))}
        />
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Satisfaction client</h4>
        <div style={{ display: 'flex', gap: '10px', fontSize: '32px' }}>
          {[1,2,3,4,5].map(star => (
            <span 
              key={star} 
              onClick={() => setReport(prev => ({...prev, rating: star}))}
              style={{ cursor: 'pointer', color: star <= report.rating ? '#fbbf24' : '#cbd5e1', transition: 'color 0.2s' }}
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Signature client</h4>
        <div style={{ border: '2px dashed #cbd5e1', padding: '15px', borderRadius: '8px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
          <SignaturePad 
            initialValue={report.signature} 
            onSave={(sig) => setReport(prev => ({...prev, signature: sig}))}
            onClear={() => setReport(prev => ({...prev, signature: null}))}
            width={400}
            height={200}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'flex-end', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
        <Button type="button" variant="ghost" onClick={onClose}>Fermer</Button>
        <Button type="button" variant="secondary" onClick={() => saveForm(false)} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer (Brouillon)'}
        </Button>
        <Button type="button" variant="primary" onClick={() => saveForm(true)} disabled={isSaving}>
          {isSaving ? 'Validation...' : 'Valider & Signer'}
        </Button>
      </div>
    </div>
  );
}
