// src/components/admin/AdminToolsPanel.js - Panneau d'outils avancés pour admin
import React, { useState, useMemo } from 'react';
import {
  DownloadIcon,
  RefreshIcon,
  TrashIcon,
  SearchIcon,
  BarChartIcon,
  FileTextIcon,
  UsersIcon,
  AlertCircleIcon
} from '../SharedUI';
import { getCacheStats, clearCompletedUploads, cleanOldUploads } from '../../utils/indexedDBCache';

export const AdminToolsPanel = ({ vaultDocuments = [], users = [], onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cacheStats, setCacheStats] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // Statistiques des documents
  const stats = useMemo(() => {
    const totalDocs = vaultDocuments.length;
    const totalSizeBytes = vaultDocuments.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    const docsByUser = vaultDocuments.reduce((acc, doc) => {
      acc[doc.user_id] = (acc[doc.user_id] || 0) + 1;
      return acc;
    }, {});

    const avgDocsPerUser = totalDocs / Math.max(Object.keys(docsByUser).length, 1);

    // Documents par type
    const docsByType = vaultDocuments.reduce((acc, doc) => {
      const ext = doc.file_name?.split('.').pop()?.toLowerCase() || 'unknown';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {});

    return {
      totalDocs,
      totalSizeMB,
      usersWithDocs: Object.keys(docsByUser).length,
      avgDocsPerUser: avgDocsPerUser.toFixed(1),
      docsByType
    };
  }, [vaultDocuments]);

  // Charger stats du cache
  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
      setShowStats(true);
    } catch (error) {
      console.error('Erreur chargement stats cache:', error);
    }
  };

  // Nettoyer cache complété
  const handleClearCompletedCache = async () => {
    if (!window.confirm('Supprimer les uploads complétés du cache?')) return;

    try {
      const count = await clearCompletedUploads();
      alert(`${count} upload(s) complété(s) supprimé(s)`);
      await loadCacheStats();
    } catch (error) {
      console.error('Erreur nettoyage cache:', error);
      alert('Erreur lors du nettoyage du cache');
    }
  };

  // Nettoyer vieux uploads
  const handleCleanOldCache = async () => {
    if (!window.confirm('Supprimer les uploads de plus de 7 jours?')) return;

    try {
      const count = await cleanOldUploads(7);
      alert(`${count} upload(s) ancien(s) supprimé(s)`);
      await loadCacheStats();
    } catch (error) {
      console.error('Erreur nettoyage anciens uploads:', error);
      alert('Erreur lors du nettoyage');
    }
  };

  // Exporter CSV
  const handleExportCSV = () => {
    const csv = [
      ['Utilisateur', 'Nom du fichier', 'Taille (MB)', 'Date d\'ajout', 'Type'].join(','),
      ...vaultDocuments.map(doc => {
        const user = users.find(u => u.id === doc.user_id);
        const userName = user ? user.full_name : 'Inconnu';
        const sizeMB = doc.file_size ? (doc.file_size / (1024 * 1024)).toFixed(2) : '0';
        const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '-';
        const type = doc.file_name?.split('.').pop()?.toUpperCase() || '-';

        return [
          `"${userName}"`,
          `"${doc.file_name || '-'}"`,
          sizeMB,
          date,
          type
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `coffre-fort-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Documents filtrés par recherche
  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return vaultDocuments;

    const term = searchTerm.toLowerCase();
    return vaultDocuments.filter(doc => {
      const user = users.find(u => u.id === doc.user_id);
      const userName = user ? user.full_name.toLowerCase() : '';
      const fileName = (doc.file_name || '').toLowerCase();

      return userName.includes(term) || fileName.includes(term);
    });
  }, [vaultDocuments, users, searchTerm]);

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>🛠️ Outils Admin</h3>

      {/* STATISTIQUES */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          <BarChartIcon /> Statistiques Générales
        </h4>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalDocs}</div>
            <div style={styles.statLabel}>Documents totaux</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalSizeMB} MB</div>
            <div style={styles.statLabel}>Taille totale</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.usersWithDocs}</div>
            <div style={styles.statLabel}>Utilisateurs</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.avgDocsPerUser}</div>
            <div style={styles.statLabel}>Docs/utilisateur (moy.)</div>
          </div>
        </div>

        <div style={styles.typesList}>
          <strong>Documents par type:</strong>
          {Object.entries(stats.docsByType).map(([ext, count]) => (
            <span key={ext} style={styles.typeBadge}>
              {ext.toUpperCase()}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* CACHE INDEXEDDB */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          💾 Gestion du Cache Mobile (IndexedDB)
        </h4>

        {!showStats && (
          <button onClick={loadCacheStats} style={styles.btnSecondary}>
            <RefreshIcon /> Voir statistiques du cache
          </button>
        )}

        {showStats && cacheStats && (
          <div>
            <div style={styles.cacheStats}>
              <div><strong>Total uploads:</strong> {cacheStats.count}</div>
              <div><strong>Taille:</strong> {cacheStats.totalSizeMB} MB</div>
              <div><strong>En attente:</strong> {cacheStats.pending}</div>
              <div><strong>En cours:</strong> {cacheStats.uploading}</div>
              <div><strong>Échoués:</strong> {cacheStats.failed}</div>
              <div><strong>Terminés:</strong> {cacheStats.completed}</div>
            </div>

            <div style={styles.buttonGroup}>
              <button onClick={handleClearCompletedCache} style={styles.btnWarning}>
                <TrashIcon /> Nettoyer complétés
              </button>
              <button onClick={handleCleanOldCache} style={styles.btnWarning}>
                <TrashIcon /> Nettoyer anciens (> 7j)
              </button>
              <button onClick={loadCacheStats} style={styles.btnSecondary}>
                <RefreshIcon /> Actualiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECHERCHE GLOBALE */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          <SearchIcon /> Recherche Globale
        </h4>
        <div style={styles.searchBox}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Rechercher par nom d'utilisateur ou nom de fichier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <span style={styles.searchResults}>
              {filteredDocs.length} résultat(s)
            </span>
          )}
        </div>

        {searchTerm && filteredDocs.length > 0 && (
          <div style={styles.resultsList}>
            {filteredDocs.slice(0, 10).map(doc => {
              const user = users.find(u => u.id === doc.user_id);
              return (
                <div key={doc.id} style={styles.resultItem}>
                  <FileTextIcon />
                  <div style={styles.resultInfo}>
                    <div style={styles.resultFileName}>{doc.file_name}</div>
                    <div style={styles.resultUser}>
                      <UsersIcon style={{ width: 12, height: 12 }} />
                      {user ? user.full_name : 'Inconnu'}
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.viewLink}
                  >
                    Voir
                  </a>
                </div>
              );
            })}
            {filteredDocs.length > 10 && (
              <div style={styles.moreResults}>
                +{filteredDocs.length - 10} résultat(s) supplémentaire(s)
              </div>
            )}
          </div>
        )}
      </div>

      {/* ACTIONS RAPIDES */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>⚡ Actions Rapides</h4>
        <div style={styles.buttonGroup}>
          <button onClick={handleExportCSV} style={styles.btnPrimary}>
            <DownloadIcon /> Exporter CSV
          </button>
          <button onClick={onRefresh} style={styles.btnSecondary}>
            <RefreshIcon /> Actualiser données
          </button>
        </div>
      </div>

      {/* ALERTES */}
      {stats.usersWithDocs < users.filter(u => !u.is_admin).length && (
        <div style={styles.alert}>
          <AlertCircleIcon />
          <span>
            {users.filter(u => !u.is_admin).length - stats.usersWithDocs} employé(s) sans document dans leur coffre-fort
          </span>
        </div>
      )}
    </div>
  );
};

const styles = {
  panel: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '1.5rem',
    color: '#1f2937'
  },
  section: {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #e5e7eb'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  },
  statCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '1rem',
    borderRadius: '8px',
    textAlign: 'center',
    color: 'white'
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: '700',
    marginBottom: '0.25rem'
  },
  statLabel: {
    fontSize: '0.875rem',
    opacity: 0.9
  },
  typesList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    fontSize: '0.9rem'
  },
  typeBadge: {
    background: '#f3f4f6',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  cacheStats: {
    background: '#f9fafb',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '0.5rem',
    fontSize: '0.9rem'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: '#f9fafb',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '2px solid #e5e7eb'
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '1rem',
    outline: 'none'
  },
  searchResults: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: '600'
  },
  resultsList: {
    marginTop: '1rem',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '0.5rem',
    background: '#f9fafb',
    transition: 'background 0.2s'
  },
  resultInfo: {
    flex: 1,
    minWidth: 0
  },
  resultFileName: {
    fontWeight: '500',
    marginBottom: '0.25rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  resultUser: {
    fontSize: '0.875rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  viewLink: {
    padding: '0.5rem 1rem',
    background: '#3b82f6',
    color: 'white',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  moreResults: {
    textAlign: 'center',
    padding: '0.75rem',
    color: '#6b7280',
    fontSize: '0.875rem'
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  btnPrimary: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem'
  },
  btnSecondary: {
    padding: '0.75rem 1.5rem',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem'
  },
  btnWarning: {
    padding: '0.75rem 1.5rem',
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fbbf24',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem'
  },
  alert: {
    background: '#fef3c7',
    border: '1px solid #fbbf24',
    padding: '1rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: '#92400e',
    fontSize: '0.9rem'
  }
};

export default AdminToolsPanel;
