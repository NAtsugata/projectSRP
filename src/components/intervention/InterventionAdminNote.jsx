import { useRef, useState } from 'react';

export default function InterventionAdminNote({ note, onSave }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const editRef = useRef(null);
  const editing = Boolean(onSave) && draft !== null;

  if (!onSave && !note) return null;

  const finishEditing = () => {
    setDraft(null);
    setError('');
    requestAnimationFrame(() => editRef.current?.focus());
  };

  const save = async event => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(draft.trim());
      finishEditing();
    } catch (error) {
      setError(error?.message || 'Réessayez dans un instant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="intervention-note" aria-labelledby="intervention-note-title">
      <header>
        <h2 id="intervention-note-title">Note administrateur</h2>
        {onSave && !editing && (
          <button ref={editRef} type="button" className="intervention-note-edit" onClick={() => {
            setDraft(note || '');
            requestAnimationFrame(() => inputRef.current?.focus());
          }}>{note ? 'Modifier la note' : 'Ajouter une note'}</button>
        )}
      </header>
      {editing ? (
        <form onSubmit={save}>
          <textarea ref={inputRef} aria-label="Consignes pour l’équipe" rows={4} value={draft} disabled={saving} onChange={event => setDraft(event.target.value)} placeholder="Accès au chantier, matériel à prévoir, consignes…" />
          {error && <p role="alert">Impossible d’enregistrer la note. {error}</p>}
          <div className="intervention-note-actions">
            <button className="intervention-note-save" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la note'}</button>
            <button className="intervention-note-edit" type="button" disabled={saving} onClick={finishEditing}>Annuler</button>
          </div>
        </form>
      ) : <p className="intervention-note-text">{note || 'Aucune consigne pour cette intervention.'}</p>}
    </section>
  );
}
