// src/pages/ChecklistView.js - CHECKLISTS D'INTERVENTION POUR EMPLOYÉS
import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  CameraIcon,
  AlertTriangleIcon,
  ClockIcon,
  FileTextIcon,
  CustomFileInput
} from '../components/SharedUI';

export default function ChecklistView({
  checklists = [],
  templates = [],
  interventions = [],
  onUpdateChecklist,
  profile
}) {
  const [activeChecklist, setActiveChecklist] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  const [photos, setPhotos] = useState({});
  const [notes, setNotes] = useState({});

  // Filtrer mes checklists
  const myChecklists = useMemo(() => {
    return checklists.filter(c => c.user_id === profile.id);
  }, [checklists, profile.id]);

  // Stats
  const stats = useMemo(() => {
    const completed = myChecklists.filter(c => c.status === 'completed').length;
    const inProgress = myChecklists.filter(c => c.status === 'in_progress').length;
    return { completed, inProgress, total: myChecklists.length };
  }, [myChecklists]);

  // Ouvrir checklist
  const openChecklist = (checklist) => {
    setActiveChecklist(checklist);
    setChecklistState(checklist.items_state || {});
    setPhotos(checklist.photos || {});
    setNotes(checklist.notes || {});
  };

  // Toggle item
  const toggleItem = (itemId) => {
    setChecklistState(prev => ({
      ...prev,
      [itemId]: {
        checked: !prev[itemId]?.checked,
        timestamp: new Date().toISOString()
      }
    }));
  };

  // Ajouter photo
  const handlePhotoCapture = useCallback((event, itemId) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos(prev => ({
          ...prev,
          [itemId]: [
            ...(prev[itemId] || []),
            {
              id: Date.now() + Math.random(),
              url: ev.target.result,
              name: file.name,
              timestamp: new Date().toISOString()
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Supprimer photo
  const removePhoto = (itemId, photoId) => {
    setPhotos(prev => ({
      ...prev,
      [itemId]: prev[itemId].filter(p => p.id !== photoId)
    }));
  };

  // Sauvegarder
  const handleSave = async () => {
    try {
      await onUpdateChecklist({
        id: activeChecklist.id,
        itemsState: checklistState,
        photos,
        notes,
        status: 'in_progress'
      });
      alert('✅ Sauvegardé');
    } catch (error) {
      alert('❌ Erreur sauvegarde');
    }
  };

  // Terminer
  const handleComplete = async () => {
    const template = templates.find(t => t.id === activeChecklist.template_id);
    if (template) {
      // Vérifier items obligatoires
      const requiredItems = template.items.filter(i => i.required);
      const missing = requiredItems.filter(i => !checklistState[i.id]?.checked);
      if (missing.length > 0) {
        alert(`⚠️ Items obligatoires:\n${missing.map(i => `• ${i.text}`).join('\n')}`);
        return;
      }

      // Vérifier photos obligatoires
      const photoRequired = template.items.filter(i => i.photoRequired);
      const missingPhotos = photoRequired.filter(i => !photos[i.id] || photos[i.id].length === 0);
      if (missingPhotos.length > 0) {
        alert(`📷 Photos manquantes:\n${missingPhotos.map(i => `• ${i.text}`).join('\n')}`);
        return;
      }
    }

    if (!window.confirm('Terminer? Vous ne pourrez plus modifier.')) return;

    try {
      await onUpdateChecklist({
        id: activeChecklist.id,
        itemsState: checklistState,
        photos,
        notes,
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      alert('✅ Checklist terminée!');
      setActiveChecklist(null);
      setChecklistState({});
      setPhotos({});
      setNotes({});
    } catch (error) {
      alert('❌ Erreur');
    }
  };

  const getProgress = (checklist) => {
    const template = templates.find(t => t.id === checklist.template_id);
    if (!template?.items) return 0;
    const checked = Object.values(checklist.items_state || {}).filter(i => i.checked).length;
    return Math.round((checked / template.items.length) * 100);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  return (
    <div>
      <style>{`
        .checklist-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          border-radius: 0.75rem;
          text-align: center;
        }
        .stat-card.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .stat-card.warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .stat-value { font-size: 2rem; font-weight: 700; }
        .stat-label { font-size: 0.875rem; opacity: 0.9; }

        .checklist-card {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 1rem;
          margin-bottom: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .checklist-card:hover {
          border-color: var(--copper-main, #CD7F32);
          box-shadow: 0 4px 12px rgba(205, 127, 50, 0.2);
        }
        .checklist-card.completed { border-color: #10b981; background: #f0fdf4; }
        .checklist-card.in-progress { border-color: #f59e0b; }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 0.5rem;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #059669);
          transition: width 0.3s;
        }

        .checklist-item {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }
        .checklist-item.checked { border-color: #10b981; background: #f0fdf4; }
        .checklist-item.required { border-left: 4px solid #ef4444; }

        .checklist-checkbox {
          width: 28px;
          height: 28px;
          min-width: 28px;
          border: 2px solid #cbd5e1;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .checklist-checkbox.checked { background: #10b981; border-color: #10b981; }

        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        .photo-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 2px solid #e5e7eb;
        }
        .photo-item img { width: 100%; height: 100%; object-fit: cover; }
        .photo-remove {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 14px;
          cursor: pointer;
        }

        .sticky-actions {
          position: sticky;
          bottom: 0;
          background: white;
          padding: 1rem;
          border-top: 2px solid #e5e7eb;
          box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
          display: flex;
          gap: 0.75rem;
          z-index: 100;
        }

        .badge {
          display: inline-flex;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
      `}</style>

      <h2 className="view-title">✅ Mes Checklists</h2>

      {/* Stats */}
      <div className="checklist-stats">
        <div className="stat-card warning">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">En cours</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Terminées</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {!activeChecklist ? (
        <div className="card-white">
          <h3 style={{ marginBottom: '1rem' }}>📋 Mes Checklists Assignées</h3>

          {myChecklists.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Aucune checklist assignée</p>
              <p className="empty-state-subtitle">Votre admin vous assignera des checklists</p>
            </div>
          ) : (
            myChecklists
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(checklist => {
                const intervention = interventions.find(i => i.id === checklist.intervention_id);
                const progress = getProgress(checklist);

                return (
                  <div
                    key={checklist.id}
                    className={`checklist-card ${checklist.status}`}
                    onClick={() => openChecklist(checklist)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                          {checklist.template_name}
                        </h4>
                        {intervention && (
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                            {intervention.title} - {intervention.client_name}
                          </p>
                        )}
                      </div>
                      <span className="badge" style={{
                        background: checklist.status === 'completed' ? '#dcfce7' : '#fef3c7',
                        color: checklist.status === 'completed' ? '#166534' : '#92400e'
                      }}>
                        {checklist.status === 'completed' ? '✅ Terminée' : '⏳ En cours'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      <ClockIcon size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      {formatDate(checklist.created_at)}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>
                        {progress}%
                      </span>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      ) : (
        <>
          <div className="card-white">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>{activeChecklist.template_name}</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                  {interventions.find(i => i.id === activeChecklist.intervention_id)?.title}
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setActiveChecklist(null);
                  setChecklistState({});
                  setPhotos({});
                  setNotes({});
                }}
              >
                Retour
              </button>
            </div>

            {/* Items */}
            {templates
              .find(t => t.id === activeChecklist.template_id)
              ?.items.map((item, idx) => {
                const isChecked = checklistState[item.id]?.checked || false;
                const itemPhotos = photos[item.id] || [];
                const itemNote = notes[item.id] || '';

                return (
                  <div
                    key={item.id}
                    className={`checklist-item ${isChecked ? 'checked' : ''} ${item.required ? 'required' : ''}`}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div
                        className={`checklist-checkbox ${isChecked ? 'checked' : ''}`}
                        onClick={() => activeChecklist.status !== 'completed' && toggleItem(item.id)}
                      >
                        {isChecked && <CheckCircleIcon style={{ color: 'white', width: '20px' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: '#1f2937' }}>
                          {idx + 1}. {item.text}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {item.required && (
                            <span className="badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                              ⚠️ Obligatoire
                            </span>
                          )}
                          {item.photoRequired && (
                            <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>
                              📷 Photo requise
                            </span>
                          )}
                        </div>

                        {activeChecklist.status !== 'completed' && (
                          <textarea
                            value={itemNote}
                            onChange={(e) => setNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Notes..."
                            className="form-control"
                            rows="2"
                            style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}
                          />
                        )}
                        {activeChecklist.status === 'completed' && itemNote && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f3f4f6', borderRadius: '0.25rem', fontSize: '0.875rem' }}>
                            📝 {itemNote}
                          </div>
                        )}

                        {itemPhotos.length > 0 && (
                          <div className="photo-grid">
                            {itemPhotos.map(photo => (
                              <div key={photo.id} className="photo-item">
                                <img src={photo.url} alt="" />
                                {activeChecklist.status !== 'completed' && (
                                  <button className="photo-remove" onClick={() => removePhoto(item.id, photo.id)}>
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {activeChecklist.status !== 'completed' && (
                          <CustomFileInput
                            onChange={(e) => handlePhotoCapture(e, item.id)}
                            accept="image/*"
                            multiple
                            style={{ marginTop: '0.5rem' }}
                          >
                            <CameraIcon /> Photo
                          </CustomFileInput>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {activeChecklist.status !== 'completed' && (
            <div className="sticky-actions">
              <button className="btn btn-secondary" onClick={handleSave} style={{ flex: 1 }}>
                💾 Sauvegarder
              </button>
              <button className="btn btn-success" onClick={handleComplete} style={{ flex: 1 }}>
                ✅ Terminer
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
