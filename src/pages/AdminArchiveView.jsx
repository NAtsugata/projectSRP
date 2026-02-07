// =============================
// FILE: src/pages/AdminArchiveView.jsx
// Vue des archives avec design amélioré
// =============================
import React, { useState, useMemo, useCallback } from 'react';
import { TrashIcon } from '../components/SharedUI';
import './AdminArchiveView.css';

export default function AdminArchiveView({
  showToast,
  showConfirmationModal,
  archivedInterventions = [],
  isLoading,
  onDelete,
  onRestore
}) {
  const [exportingId, setExportingId] = useState(null);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Calcul des statistiques
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const thisMonthCount = archivedInterventions.filter(int => {
      const date = new Date(int.archived_at || int.date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    const lastMonthCount = archivedInterventions.filter(int => {
      const date = new Date(int.archived_at || int.date);
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    }).length;

    return {
      total: archivedInterventions.length,
      thisMonth: thisMonthCount,
      lastMonth: lastMonthCount
    };
  }, [archivedInterventions]);

  // Options de filtrage par mois
  const monthOptions = useMemo(() => {
    const months = new Set();
    archivedInterventions.forEach(int => {
      const date = new Date(int.archived_at || int.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, [archivedInterventions]);

  // Filtrage des archives
  const filteredArchives = useMemo(() => {
    let filtered = [...archivedInterventions];

    // Recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(int =>
        (int.client || '').toLowerCase().includes(term) ||
        (int.service || '').toLowerCase().includes(term) ||
        (int.address || '').toLowerCase().includes(term)
      );
    }

    // Filtre par mois
    if (filterMonth !== 'all') {
      filtered = filtered.filter(int => {
        const date = new Date(int.archived_at || int.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === filterMonth;
      });
    }

    // Tri par date décroissante
    filtered.sort((a, b) => new Date(b.archived_at || b.date) - new Date(a.archived_at || a.date));

    return filtered;
  }, [archivedInterventions, searchTerm, filterMonth]);

  // Gestion de la sélection
  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredArchives.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArchives.map(a => a.id)));
    }
  }, [filteredArchives, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Suppression
  const handleDeleteArchive = useCallback((id) => {
    showConfirmationModal({
      title: "Supprimer l'archive définitivement ?",
      message: "Cette action est irréversible. Toutes les données seront perdues.",
      onConfirm: () => {
        onDelete(id);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }, [showConfirmationModal, onDelete]);

  // Suppression en masse
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    showConfirmationModal({
      title: `Supprimer ${selectedIds.size} archive(s) ?`,
      message: "Cette action est irréversible. Toutes les données seront perdues.",
      onConfirm: async () => {
        for (const id of selectedIds) {
          await onDelete(id);
        }
        setSelectedIds(new Set());
        showToast(`${selectedIds.size} archive(s) supprimée(s)`, 'success');
      }
    });
  }, [selectedIds, showConfirmationModal, onDelete, showToast]);

  // Restauration
  const handleRestore = useCallback((id) => {
    if (!onRestore) return;

    showConfirmationModal({
      title: "Restaurer cette intervention ?",
      message: "L'intervention sera de nouveau visible dans le planning.",
      onConfirm: () => {
        onRestore(id);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast('Intervention restaurée', 'success');
      }
    });
  }, [showConfirmationModal, onRestore, showToast]);

  // Restauration en masse
  const handleBulkRestore = useCallback(() => {
    if (selectedIds.size === 0 || !onRestore) return;

    showConfirmationModal({
      title: `Restaurer ${selectedIds.size} intervention(s) ?`,
      message: "Les interventions seront de nouveau visibles dans le planning.",
      onConfirm: async () => {
        for (const id of selectedIds) {
          await onRestore(id);
        }
        setSelectedIds(new Set());
        showToast(`${selectedIds.size} intervention(s) restaurée(s)`, 'success');
      }
    });
  }, [selectedIds, showConfirmationModal, onRestore, showToast]);

  // Export en masse
  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const selectedArchives = filteredArchives.filter(a => selectedIds.has(a.id));
    if (selectedArchives.length === 0) return;

    setIsBulkExporting(true);
    showToast(`Export de ${selectedArchives.length} archive(s) en cours...`);

    let successCount = 0;
    for (const intervention of selectedArchives) {
      try {
        await handleExportSingle(intervention);
        successCount++;
        // Petit délai entre chaque export pour éviter les problèmes
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erreur export ${intervention.id}:`, error);
      }
    }

    setIsBulkExporting(false);
    showToast(`${successCount}/${selectedArchives.length} archive(s) exportée(s)`, 'success');
  }, [selectedIds, filteredArchives, showToast]);

  // Export ZIP (version interne sans toast de fin)
  const handleExportSingle = async (intervention) => {
    if (typeof window.jspdf === 'undefined' || typeof window.JSZip === 'undefined') {
      throw new Error("Librairies d'exportation manquantes");
    }

    const isDataUrl = (u) => typeof u === 'string' && u.startsWith('data:');
    const safeName = (name) => {
      const base = (name || 'fichier').split('?')[0].replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
      return base || 'fichier';
    };
    const uniquify = (() => {
      const seen = new Map();
      return (name) => {
        const base = safeName(name);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        if (count === 0) return base;
        const dot = base.lastIndexOf('.');
        return dot > 0 ? `${base.slice(0, dot)}_${count}${base.slice(dot)}` : `${base}_${count}`;
      };
    })();
    const extractUrl = (item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      return item.url || item.file_url || item.path || null;
    };
    const isImg = (u) => typeof u === 'string' && (u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u));

    const getFileContent = async (urlOrData, fallbackName = 'fichier') => {
      if (!urlOrData) return null;
      if (isDataUrl(urlOrData)) {
        try {
          const [, meta, data] = urlOrData.match(/^data:([^;]+);base64,(.+)$/) || [];
          if (!data) throw new Error('Data URL invalide');
          const mime = meta || 'application/octet-stream';
          return { isBase64: true, base64Data: data, mime, name: uniquify(fallbackName) };
        } catch (e) {
          return null;
        }
      }
      try {
        const res = await fetch(urlOrData, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = uniquify(urlOrData.split('/').pop() || fallbackName);
        return { blob, name };
      } catch (e) {
        return null;
      }
    };

    const { jsPDF } = window.jspdf;
    const JSZip = window.JSZip;
    const doc = new jsPDF();

    const title = `Rapport d'intervention - ${intervention.client || ''}`;
    doc.setFontSize(14);
    doc.text(title, 10, 10);
    doc.setFontSize(11);
    doc.text('Date: ' + (intervention.date || ''), 10, 20);
    doc.text('Service: ' + (intervention.service || ''), 10, 27);
    if (intervention.address) {
      doc.text('Adresse: ' + intervention.address, 10, 34);
    }

    let y = intervention.address ? 44 : 36;
    doc.text('Notes:', 10, y);
    y += 6;
    const notes = doc.splitTextToSize(intervention.report?.notes || 'Aucune', 180);
    doc.text(notes, 10, y);
    y += notes.length * 6 + 2;

    if (intervention.report?.signature && isDataUrl(intervention.report.signature)) {
      if (y > 200) { doc.addPage(); y = 10; }
      doc.text('Signature du client', 10, y);
      const sigMime = (intervention.report.signature.split(';')[0] || 'image/png').replace('data:', '');
      const fmt = /jpeg|jpg/i.test(sigMime) ? 'JPEG' : 'PNG';
      doc.addImage(intervention.report.signature, fmt, 10, y + 5, 180, 80);
    }

    const zip = new JSZip();
    zip.file('Rapport.pdf', doc.output('blob'));

    const tasks = [];

    // Documents de préparation
    const briefingFolder = zip.folder('documents_preparation');
    if (Array.isArray(intervention.intervention_briefing_documents)) {
      for (const d of intervention.intervention_briefing_documents) {
        const name = d?.file_name || 'document';
        const url = d?.file_url;
        tasks.push((async () => {
          const file = await getFileContent(url, name);
          if (!file) return;
          if (file.isBase64) briefingFolder.file(file.name, file.base64Data, { base64: true });
          else briefingFolder.file(file.name, file.blob);
        })());
      }
    }

    // Photos chantier
    const photosFolder = zip.folder('photos_chantier');
    const reportImages = Array.isArray(intervention?.report?.files)
      ? intervention.report.files.map(extractUrl).filter(u => u && isImg(u))
      : [];
    for (const imageUrl of reportImages) {
      const fallbackName = (typeof imageUrl === 'string' && imageUrl.split('/').pop()) || 'photo.jpg';
      tasks.push((async () => {
        const file = await getFileContent(imageUrl, fallbackName);
        if (!file) return;
        if (file.isBase64) photosFolder.file(file.name, file.base64Data, { base64: true });
        else photosFolder.file(file.name, file.blob);
      })());
    }

    await Promise.all(tasks);
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `Archive-${safeName(intervention.client || 'Intervention')}-${intervention.date || intervention.id}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Export ZIP
  const handleExport = async (intervention) => {
    setExportingId(intervention.id);
    if (typeof window.jspdf === 'undefined' || typeof window.JSZip === 'undefined') {
      showToast("Librairies d'exportation manquantes.", "error");
      setExportingId(null);
      return;
    }
    showToast("Préparation de l'export... Veuillez patienter.");

    const isDataUrl = (u) => typeof u === 'string' && u.startsWith('data:');
    const safeName = (name) => {
      const base = (name || 'fichier').split('?')[0].replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
      return base || 'fichier';
    };
    const uniquify = (() => {
      const seen = new Map();
      return (name) => {
        const base = safeName(name);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        if (count === 0) return base;
        const dot = base.lastIndexOf('.');
        return dot > 0 ? `${base.slice(0, dot)}_${count}${base.slice(dot)}` : `${base}_${count}`;
      };
    })();
    const extractUrl = (item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      return item.url || item.file_url || item.path || null;
    };
    const isImg = (u) => typeof u === 'string' && (u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u));

    const getFileContent = async (urlOrData, fallbackName = 'fichier') => {
      if (!urlOrData) return null;
      if (isDataUrl(urlOrData)) {
        try {
          const [, meta, data] = urlOrData.match(/^data:([^;]+);base64,(.+)$/) || [];
          if (!data) throw new Error('Data URL invalide');
          const mime = meta || 'application/octet-stream';
          return { isBase64: true, base64Data: data, mime, name: uniquify(fallbackName) };
        } catch (e) {
          return null;
        }
      }
      try {
        const res = await fetch(urlOrData, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const name = uniquify(urlOrData.split('/').pop() || fallbackName);
        return { blob, name };
      } catch (e) {
        return null;
      }
    };

    try {
      const { jsPDF } = window.jspdf;
      const JSZip = window.JSZip;
      const doc = new jsPDF();

      const title = `Rapport d'intervention - ${intervention.client || ''}`;
      doc.setFontSize(14);
      doc.text(title, 10, 10);
      doc.setFontSize(11);
      doc.text('Date: ' + (intervention.date || ''), 10, 20);
      doc.text('Service: ' + (intervention.service || ''), 10, 27);
      if (intervention.address) {
        doc.text('Adresse: ' + intervention.address, 10, 34);
      }

      let y = intervention.address ? 44 : 36;
      doc.text('Notes:', 10, y);
      y += 6;
      const notes = doc.splitTextToSize(intervention.report?.notes || 'Aucune', 180);
      doc.text(notes, 10, y);
      y += notes.length * 6 + 2;

      // Besoins et demandes
      const needs = Array.isArray(intervention.report?.needs) ? intervention.report.needs : [];
      const requests = Array.isArray(intervention.report?.supply_requests) ? intervention.report.supply_requests : [];

      if (needs.length) {
        if (y > 250) { doc.addPage(); y = 10; }
        doc.text('Besoins chantier:', 10, y);
        y += 6;
        for (const n of needs) {
          const line = `• [${n.category || '—'}] ${n.label}${n.qty ? ' × ' + n.qty : ''}${n.urgent ? ' [URGENT]' : ''}${typeof n.estimated_price === 'number' ? ' — ' + n.estimated_price.toFixed(2) + ' €' : ''}`;
          const t = doc.splitTextToSize(line, 180);
          if (y + t.length * 6 > 280) { doc.addPage(); y = 10; }
          doc.text(t, 10, y);
          y += t.length * 6;
        }
      }

      if (requests.length) {
        if (y > 250) { doc.addPage(); y = 10; }
        doc.text('Demandes de fourniture:', 10, y);
        y += 6;
        for (const r of requests) {
          const head = `#${r.id} — ${new Date(r.created_at).toLocaleString('fr-FR')} — ${r.status}`;
          const ht = doc.splitTextToSize(head, 180);
          if (y + ht.length * 6 > 280) { doc.addPage(); y = 10; }
          doc.text(ht, 10, y);
          y += ht.length * 6;
          for (const i of r.items || []) {
            const line = `   · ${i.label} × ${i.qty || 1}`;
            const t = doc.splitTextToSize(line, 180);
            if (y + t.length * 6 > 280) { doc.addPage(); y = 10; }
            doc.text(t, 10, y);
            y += t.length * 6;
          }
        }
      }

      if (intervention.report?.signature) {
        if (y > 200) { doc.addPage(); y = 10; }
        doc.text('Signature du client', 10, y);
        if (isDataUrl(intervention.report.signature)) {
          const sigMime = (intervention.report.signature.split(';')[0] || 'image/png').replace('data:', '');
          const fmt = /jpeg|jpg/i.test(sigMime) ? 'JPEG' : 'PNG';
          doc.addImage(intervention.report.signature, fmt, 10, y + 5, 180, 80);
        }
      }

      const zip = new JSZip();
      zip.file('Rapport.pdf', doc.output('blob'));

      const tasks = [];

      // Documents de préparation
      const briefingFolder = zip.folder('documents_preparation');
      if (Array.isArray(intervention.intervention_briefing_documents)) {
        for (const d of intervention.intervention_briefing_documents) {
          const name = d?.file_name || 'document';
          const url = d?.file_url;
          tasks.push((async () => {
            const file = await getFileContent(url, name);
            if (!file) return;
            if (file.isBase64) briefingFolder.file(file.name, file.base64Data, { base64: true });
            else briefingFolder.file(file.name, file.blob);
          })());
        }
      }

      // Photos chantier
      const photosFolder = zip.folder('photos_chantier');
      const reportImages = Array.isArray(intervention?.report?.files)
        ? intervention.report.files.map(extractUrl).filter(u => u && isImg(u))
        : [];
      for (const imageUrl of reportImages) {
        const fallbackName = (typeof imageUrl === 'string' && imageUrl.split('/').pop()) || 'photo.jpg';
        tasks.push((async () => {
          const file = await getFileContent(imageUrl, fallbackName);
          if (!file) return;
          if (file.isBase64) photosFolder.file(file.name, file.base64Data, { base64: true });
          else photosFolder.file(file.name, file.blob);
        })());
      }

      // Photos employé
      const employeePhotosFolder = zip.folder('photos_employe');
      const possibleKeys = ['employee_photos', 'employeePhotos', 'photos_employee'];
      let employeePhotos = [];
      for (const key of possibleKeys) {
        const arr = intervention[key] || intervention.report?.[key];
        if (Array.isArray(arr) && arr.length) {
          employeePhotos = arr;
          break;
        }
      }
      for (const imageItem of employeePhotos) {
        const url = extractUrl(imageItem);
        if (!url || !isImg(url)) continue;
        const fallbackName = (typeof url === 'string' && url.split('/').pop()) || 'photo_employe.jpg';
        tasks.push((async () => {
          const file = await getFileContent(url, fallbackName);
          if (!file) return;
          if (file.isBase64) employeePhotosFolder.file(file.name, file.base64Data, { base64: true });
          else employeePhotosFolder.file(file.name, file.blob);
        })());
      }

      await Promise.all(tasks);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Archive-${safeName(intervention.client || 'Intervention')}-${intervention.date || intervention.id}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      showToast('Export terminé !', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'exportation: ' + (error?.message || String(error)), 'error');
    } finally {
      setExportingId(null);
    }
  };

  // Formater la date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Formater le mois pour le select
  const formatMonthOption = (key) => {
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (isLoading) return <div className="loading-spinner"></div>;

  return (
    <div>
      {/* Header */}
      <div className="archive-header">
        <h2 className="archive-title">Archives</h2>
      </div>

      {/* Stats */}
      <div className="archive-stats">
        <div className="archive-stat-card">
          <div className="archive-stat-value">{stats.total}</div>
          <div className="archive-stat-label">Total archives</div>
        </div>
        <div className="archive-stat-card">
          <div className="archive-stat-value">{stats.thisMonth}</div>
          <div className="archive-stat-label">Ce mois</div>
        </div>
        <div className="archive-stat-card">
          <div className="archive-stat-value">{stats.lastMonth}</div>
          <div className="archive-stat-label">Mois dernier</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="archive-toolbar">
        <input
          type="text"
          className="archive-search"
          placeholder="Rechercher par client, service, adresse..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="archive-filter-select"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        >
          <option value="all">Tous les mois</option>
          {monthOptions.map(key => (
            <option key={key} value={key}>{formatMonthOption(key)}</option>
          ))}
        </select>
        {filteredArchives.length > 0 && (
          <button
            className="archive-btn"
            onClick={toggleSelectAll}
          >
            {selectedIds.size === filteredArchives.length ? 'Désélectionner tout' : 'Tout sélectionner'}
          </button>
        )}
      </div>

      {/* Selection bar */}
      {selectedIds.size > 0 && (
        <div className="archive-selection-bar">
          <span className="archive-selection-info">
            {selectedIds.size} archive(s) sélectionnée(s)
          </span>
          <div className="archive-selection-actions">
            <button
              className="archive-selection-btn"
              onClick={handleBulkExport}
              disabled={isBulkExporting}
            >
              {isBulkExporting ? 'Export...' : 'Exporter'}
            </button>
            {onRestore && (
              <button className="archive-selection-btn" onClick={handleBulkRestore}>
                Restaurer
              </button>
            )}
            <button className="archive-selection-btn danger" onClick={handleBulkDelete}>
              Supprimer
            </button>
            <button className="archive-selection-btn" onClick={clearSelection}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Archive list */}
      <div className="archive-container">
        {filteredArchives.length > 0 ? (
          <ul className="archive-list">
            {filteredArchives.map(int => (
              <li
                key={int.id}
                className={`archive-item ${selectedIds.has(int.id) ? 'selected' : ''}`}
              >
                <label className="archive-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(int.id)}
                    onChange={() => toggleSelection(int.id)}
                  />
                  <span className="archive-checkbox-custom"></span>
                </label>

                <div className="archive-content">
                  <p className="archive-client">{int.client || 'Client inconnu'}</p>
                  <div className="archive-meta">
                    <span className="archive-meta-item">
                      {int.service || 'Service non spécifié'}
                    </span>
                    <span className="archive-meta-item">
                      {formatDate(int.date)}
                    </span>
                    {int.address && (
                      <span className="archive-meta-item">
                        {int.address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="archive-actions">
                  <button
                    className="archive-btn primary"
                    onClick={() => handleExport(int)}
                    disabled={exportingId === int.id}
                  >
                    {exportingId === int.id ? 'Export...' : 'Exporter ZIP'}
                  </button>
                  {onRestore && (
                    <button
                      className="archive-btn restore"
                      onClick={() => handleRestore(int.id)}
                      title="Restaurer dans le planning"
                    >
                      Restaurer
                    </button>
                  )}
                  <button
                    className="archive-btn-icon danger"
                    onClick={() => handleDeleteArchive(int.id)}
                    title="Supprimer définitivement"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="archive-empty">
            <div className="archive-empty-icon">📦</div>
            <p className="archive-empty-title">
              {searchTerm || filterMonth !== 'all'
                ? 'Aucun résultat'
                : 'Aucune archive'}
            </p>
            <p className="archive-empty-text">
              {searchTerm || filterMonth !== 'all'
                ? 'Modifiez vos filtres pour trouver des archives'
                : 'Les interventions archivées apparaîtront ici'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
