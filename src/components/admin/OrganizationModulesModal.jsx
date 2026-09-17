// Super-admin : modules d'une organisation (formule, options à la carte, essais)
import { useEffect, useState, useCallback } from 'react';
import { moduleService } from '../../services/moduleService';

const CATEGORY_LABELS = { terrain: 'Terrain', gestion: 'Gestion', commercial: 'Commercial', conformite: 'Conformité' };
const SOURCE_LABELS = { plan: 'formule', addon: 'option', trial: 'essai', manual: 'manuel', none: '—' };

const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function OrganizationModulesModal({ organization, onClose, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await moduleService.adminListOrganizationModules(organization.id);
    if (error) toast?.error?.(error.message);
    setRows(data || []);
    setLoading(false);
  }, [organization.id, toast]);

  useEffect(() => { load(); }, [load]);

  const setModule = async (row, patch) => {
    setBusyKey(row.module_key);
    const next = {
      enabled: patch.enabled ?? row.enabled,
      source: patch.source ?? (row.is_explicit ? row.source : 'addon'),
      endsAt: patch.endsAt === undefined ? (row.ends_at || null) : patch.endsAt,
    };
    if (next.source === 'plan') next.source = 'addon';
    const { error } = await moduleService.adminSetOrganizationModule(organization.id, row.module_key, next);
    if (error) toast?.error?.(error.message);
    await load();
    setBusyKey(null);
  };

  const resetModule = async (row) => {
    setBusyKey(row.module_key);
    const { error } = await moduleService.adminResetOrganizationModule(organization.id, row.module_key);
    if (error) toast?.error?.(error.message);
    await load();
    setBusyKey(null);
  };

  const grouped = rows.reduce((acc, r) => { (acc[r.category || 'autre'] ||= []).push(r); return acc; }, {});
  const enabledCount = rows.filter(r => r.enabled).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content org-modal org-modules-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Modules — {organization.name}</h3>
        <p className="org-subtitle">
          Formule <strong>{organization.plan}</strong> · {enabledCount}/{rows.length} modules actifs.
          Un réglage explicite (option, essai, manuel) prime sur la formule.
        </p>

        {loading ? <p>Chargement…</p> : (
          <div className="org-modules-groups">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat} className="org-modules-group">
                <h4>{CATEGORY_LABELS[cat] || cat}</h4>
                {list.map(row => {
                  const busy = busyKey === row.module_key;
                  const expired = row.ends_at && new Date(row.ends_at) < new Date();
                  return (
                    <div key={row.module_key} className={`org-module-row ${row.enabled ? 'is-on' : 'is-off'}`}>
                      <label className="org-module-toggle">
                        <input
                          type="checkbox"
                          checked={!!row.enabled}
                          disabled={busy}
                          onChange={(e) => setModule(row, { enabled: e.target.checked })}
                        />
                        <span className="org-module-label">{row.label}</span>
                      </label>
                      <span className={`org-module-source source-${row.is_explicit ? row.source : (row.in_plan ? 'plan' : 'none')}`}>
                        {row.is_explicit ? SOURCE_LABELS[row.source] : (row.in_plan ? 'formule' : 'non inclus')}
                        {expired ? ' · expiré' : ''}
                      </span>
                      <select
                        className="form-control org-module-select"
                        value={row.is_explicit ? row.source : 'plan'}
                        disabled={busy}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'plan') resetModule(row);
                          else setModule(row, { source: v, enabled: true });
                        }}
                        title="Origine du droit"
                      >
                        <option value="plan">Selon la formule</option>
                        <option value="addon">Option à la carte</option>
                        <option value="trial">Essai</option>
                        <option value="manual">Manuel</option>
                      </select>
                      <input
                        type="date"
                        className="form-control org-module-date"
                        value={toDateInput(row.ends_at)}
                        disabled={busy || !row.is_explicit}
                        title="Fin de validité (essai / option)"
                        onChange={(e) => setModule(row, { endsAt: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Fermer</button>
        </div>
      </div>
    </div>
  );
}
