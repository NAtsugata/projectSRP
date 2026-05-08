import React, { useState } from 'react';
import './CerfaCounterEditor.css';

/**
 * Panel d'ajustement du compteur CERFA.
 * Permet de caler le compteur sur le dernier numéro utilisé
 * (CERFA papier, correction, reprise après interruption…).
 *
 * Props :
 *  ficheInfo  — objet { year, count, nextNumber, formatted }
 *  setCounter — async (count: number) => void  (depuis useCerfaCounter)
 *  onClose    — () => void
 */
export default function CerfaCounterEditor({ ficheInfo, setCounter, onClose }) {
    const [value, setValue] = useState(String(ficheInfo.count));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const parsed = parseInt(value, 10);
    const isValid = !isNaN(parsed) && parsed >= 0;
    const nextPreview = isValid ? parsed + 1 : '?';

    async function handleApply() {
        if (!isValid) { setError('Numéro invalide'); return; }
        setSaving(true);
        setError('');
        try {
            await setCounter(parsed);
            onClose();
        } catch (e) {
            setError('Erreur lors de la mise à jour : ' + (e?.message || e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="cce-panel">
            <div className="cce-header">
                <span className="cce-title">Ajuster le compteur</span>
                <button className="cce-close" onClick={onClose} type="button">✕</button>
            </div>

            <p className="cce-help">
                Entrez le numéro du <strong>dernier CERFA utilisé</strong> (papier ou numérique).
                Le prochain numéro généré sera automatiquement <strong>+1</strong>.
            </p>

            <div className="cce-current">
                Compteur actuel&nbsp;: <strong>{ficheInfo.count}</strong>
                &nbsp;·&nbsp;Prochain&nbsp;: <strong>{ficheInfo.formatted}</strong>
            </div>

            <div className="cce-row">
                <label className="cce-label">Dernier CERFA créé (n°)</label>
                <div className="cce-input-row">
                    <input
                        className="cce-input"
                        type="number"
                        min="0"
                        value={value}
                        onChange={e => { setValue(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleApply()}
                        autoFocus
                    />
                    <span className="cce-arrow">→</span>
                    <span className="cce-preview">
                        Prochain&nbsp;: <strong>
                            {ficheInfo.year}-{String(nextPreview).padStart(4, '0')}
                        </strong>
                    </span>
                </div>
                {error && <p className="cce-error">{error}</p>}
            </div>

            <div className="cce-actions">
                <button className="cce-btn cce-btn--cancel" type="button" onClick={onClose}>
                    Annuler
                </button>
                <button
                    className="cce-btn cce-btn--apply"
                    type="button"
                    onClick={handleApply}
                    disabled={!isValid || saving}
                >
                    {saving ? 'Enregistrement…' : 'Appliquer'}
                </button>
            </div>
        </div>
    );
}
