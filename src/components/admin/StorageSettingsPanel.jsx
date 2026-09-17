// Onglet « Stockage » des réglages : usage / quota de l'organisation,
// migration des anciens justificatifs (base64 → Storage), fichiers orphelins.
import { useState, useEffect, useCallback } from 'react';
import storageService from '../../services/storageService';
import expenseService from '../../services/expenseService';
import logger from '../../utils/logger';

const UNITS = ['o', 'Ko', 'Mo', 'Go', 'To'];
export const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '–';
  let v = Number(bytes); let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i > 0 && v < 10 ? 1 : 0)} ${UNITS[i]}`;
};

const CATEGORY_LABELS = {
  expenses: 'Justificatifs de dépenses',
  interventions: "Fichiers d'interventions",
  photos: "Photos d'intervention",
  vault: 'Coffre-fort',
  scans: 'Documents scannés',
  signatures: 'Signatures',
  'ir-shower': 'IR Douche',
  cerfa: 'CERFA',
  quotes: 'Devis',
  assets: 'Logo / identité visuelle',
  chantiers: 'Chantiers',
  autre: 'Autre',
};

export default function StorageSettingsPanel({ toast }) {
  const [usage, setUsage] = useState(null);
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migration, setMigration] = useState(null); // { done, total, summary }
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u, error: e1 }, { data: o, error: e2 }] = await Promise.all([
      storageService.getOrganizationUsage(),
      storageService.listOrphans(),
    ]);
    if (e1) logger.error('[storage] usage:', e1);
    if (e2) logger.error('[storage] orphelins:', e2);
    setUsage(u || null);
    setOrphans(o || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runMigration = async () => {
    const ok = window.confirm(
      "Déplacer les anciens justificatifs vers le stockage de fichiers ?\n" +
      "Les originaux sont conservés en base jusqu'à une purge explicite. Rien n'est supprimé."
    );
    if (!ok) return;
    setMigration({ done: 0, total: usage?.legacy_expenses || 0, summary: null });
    const { data, error } = await expenseService.migrateLegacyReceipts({
      onProgress: (done, total, summary) => setMigration({ done, total, summary: null, partial: summary }),
    });
    if (error) toast?.error?.(error.message);
    else toast?.success?.(`${data.migrated} note(s) migrée(s), ${data.files} fichier(s) déplacé(s)`);
    setMigration({ done: data.total, total: data.total, summary: data });
    load();
  };

  const cleanOrphans = async () => {
    if (!orphans.length) return;
    if (!window.confirm(`Supprimer définitivement ${orphans.length} fichier(s) orphelin(s) ?`)) return;
    setCleaning(true);
    const byBucket = orphans.reduce((acc, o) => { (acc[o.bucket_id] ||= []).push(o.object_name); return acc; }, {});
    for (const [bucket, paths] of Object.entries(byBucket)) {
      await storageService.removeFiles(bucket, paths);
    }
    setCleaning(false);
    toast?.success?.('Fichiers orphelins supprimés');
    load();
  };

  const pct = usage?.quota_bytes ? Math.min(100, Math.round((usage.used_bytes / usage.quota_bytes) * 100)) : 0;
  const barColor = pct > 90 ? '#dc2626' : pct > 70 ? '#f59e0b' : '#16a34a';
  const categories = Object.entries(usage?.by_category || {}).sort((a, b) => b[1] - a[1]);
  const orphanBytes = orphans.reduce((s, o) => s + (Number(o.size_bytes) || 0), 0);
  const migrating = migration && !migration.summary;

  return (
    <div className="settings-section">
      <h2>Stockage des fichiers</h2>
      <p className="section-desc">
        Espace utilisé par votre organisation (photos, documents, justificatifs) et opérations de maintenance.
      </p>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <>
          <div className="storage-usage">
            <div className="storage-bar">
              <div className="storage-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <p>
              <strong>{formatBytes(usage?.used_bytes)}</strong> utilisés sur {formatBytes(usage?.quota_bytes)} ({pct} %)
              {' · '}{usage?.files ?? 0} fichier{(usage?.files ?? 0) > 1 ? 's' : ''}
            </p>
          </div>

          {categories.length > 0 && (
            <table className="storage-table">
              <tbody>
                {categories.map(([cat, bytes]) => (
                  <tr key={cat}>
                    <td>{CATEGORY_LABELS[cat] || cat}</td>
                    <td className="storage-table-size">{formatBytes(bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Anciens justificatifs de dépenses</h3>
          {usage?.legacy_expenses > 0 ? (
            <>
              <p>
                {usage.legacy_expenses} note{usage.legacy_expenses > 1 ? 's' : ''} de frais {usage.legacy_expenses > 1 ? 'ont' : 'a'} encore
                {' '}ses photos stockées dans la base de données (ancien format). Les déplacer vers le stockage
                de fichiers accélère l'application ; les originaux sont conservés.
              </p>
              <button type="button" className="btn btn-primary" onClick={runMigration} disabled={migrating}>
                {migrating ? `Migration… ${migration.done}/${migration.total}` : 'Migrer vers le stockage de fichiers'}
              </button>
              {migration?.summary && (
                <p className="settings-help">
                  {migration.summary.migrated} migrée(s), {migration.summary.files} fichier(s), {migration.summary.skipped} ignorée(s)
                  {migration.summary.errors.length > 0 && `, ${migration.summary.errors.length} erreur(s)`}
                </p>
              )}
            </>
          ) : (
            <p className="settings-help">✅ Tous les justificatifs sont dans le stockage de fichiers.</p>
          )}

          <h3>Fichiers orphelins</h3>
          {orphans.length === 0 ? (
            <p className="settings-help">✅ Aucun fichier orphelin.</p>
          ) : (
            <>
              <p>
                {orphans.length} fichier{orphans.length > 1 ? 's' : ''} ({formatBytes(orphanBytes)}) dont l'élément
                parent (dépense, intervention, chantier) a été supprimé.
              </p>
              <button type="button" className="btn btn-secondary" onClick={cleanOrphans} disabled={cleaning}>
                {cleaning ? 'Suppression…' : 'Supprimer les orphelins'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
