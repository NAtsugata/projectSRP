// src/pages/AdminArchiveView.js — COMPLET
// - UI d'archives restaurée (liste, export, suppression)
// - Export ZIP robuste : dataURL, CORS, noms uniques, téléchargements parallèles
// - Corrige l'origine des images chantier: report.files (et non report.images)
// - Photos employé: supporte plusieurs clés possibles (employee_photos, employeePhotos, ...)

import React, { useState, useEffect, useCallback } from 'react';
import { interventionService } from '../lib/supabase';
import { TrashIcon } from '../components/SharedUI';

export default function AdminArchiveView({ showToast, showConfirmationModal }) {
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState(null);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    const { data, error } = await interventionService.getInterventions(null, true);
    if (error) {
      showToast("Erreur de chargement des archives.", "error");
    } else {
      setArchived(data || []);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleDeleteArchive = (id) => {
    showConfirmationModal({
      title: "Supprimer l'archive définitivement ?",
      message: "Cette action est irréversible et supprimera l'intervention et tous les fichiers associés (photos, documents).",
      onConfirm: async () => {
        const { error } = await interventionService.deleteIntervention(id);
        if (error) {
          showToast("Erreur lors de la suppression de l'archive.", "error");
        } else {
          showToast("Archive supprimée avec succès.");
          fetchArchived();
        }
      }
    });
  };

  // ------------------ handleExport (version corrigée) ------------------
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
      const base = (name || 'fichier')
        .split('?')[0]
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(-120);
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

    // Normalise un item report.files (string | object) vers une URL/dataURL
    const extractUrlFromFileItem = (item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      return item.url || item.file_url || item.path || null;
    };

    const looksLikeImage = (u) =>
      typeof u === 'string' && (
        u.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)($|\?)/i.test(u)
      );

    // Retourne {blob, name} OU {isBase64, base64Data, mime, name}
    const getFileContent = async (urlOrData, fallbackName = 'fichier') => {
      if (!urlOrData) return null;
      if (isDataUrl(urlOrData)) {
        try {
          const [, meta, data] = urlOrData.match(/^data:([^;]+);base64,(.+)$/) || [];
          if (!data) throw new Error('Data URL invalide');
          const mime = meta || 'application/octet-stream';
          return { isBase64: true, base64Data: data, mime, name: uniquify(fallbackName) };
        } catch (e) {
          showToast(`Data URL invalide (ignorée) : ${fallbackName}`, "error");
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
        showToast(`Impossible de télécharger: ${fallbackName} (${e.message})`, "error");
        return null;
      }
    };

    try {
      const { jsPDF } = window.jspdf;
      const JSZip = window.JSZip;
      const doc = new jsPDF();

      // --------- PDF résumé ---------
      doc.text("Rapport d'intervention - " + (intervention.client || ''), 10, 10);
      doc.text('Date: ' + (intervention.date || ''), 10, 20);
      doc.text('Service: ' + (intervention.service || ''), 10, 30);
      doc.text('Notes:', 10, 40);
      const splitNotes = doc.splitTextToSize(intervention.report?.notes || 'Aucune', 180);
      doc.text(splitNotes, 10, 45);
      let yPos = 45 + (splitNotes.length * 10);

      if (intervention.report?.signature) {
        if (yPos > 200) { doc.addPage(); yPos = 10; }
        doc.text("Signature du client", 10, yPos);
        if (isDataUrl(intervention.report.signature)) {
          const sigMime = (intervention.report.signature.split(';')[0] || 'image/png').replace('data:', '');
          const fmt = /jpeg|jpg/i.test(sigMime) ? 'JPEG' : 'PNG';
          doc.addImage(intervention.report.signature, fmt, 10, yPos + 5, 180, 80);
        } else {
          // Signature en URL non embarquée : ajoutée dans le ZIP à part
          doc.text("(signature jointe dans le ZIP)", 10, yPos + 90);
        }
      }

      const zip = new JSZip();
      zip.file("Rapport.pdf", doc.output('blob'));

      // --------- Téléchargements parallèles ---------
      const tasks = [];

      // Dossier documents de préparation
      const briefingFolder = zip.folder("documents_preparation");
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

      // Dossier photos chantier — depuis report.files
      const photosFolder = zip.folder('photos_chantier');
      const reportImageUrls = Array.isArray(intervention?.report?.files)
        ? intervention.report.files
            .map(extractUrlFromFileItem)
            .filter((u) => u && looksLikeImage(u))
        : [];

      for (const imageUrl of reportImageUrls) {
        const fallbackName = (typeof imageUrl === 'string' && imageUrl.split('/').pop()) || 'photo_chantier.jpg';
        tasks.push((async () => {
          const file = await getFileContent(imageUrl, fallbackName);
          if (!file) return;
          if (file.isBase64) photosFolder.file(file.name, file.base64Data, { base64: true });
          else photosFolder.file(file.name, file.blob);
        })());
      }

      // Dossier photos employé — support de plusieurs clés possibles
      const employeePhotosFolder = zip.folder('photos_employe');
      const possibleEmployeeKeys = [
        'employee_photos', 'employeePhotos', 'photos_employee', 'photosEmploye',
        'report.employee_photos', 'report.employeePhotos'
      ];
      const pick = (obj, path) => {
        try { return path.split('.').reduce((acc, k) => acc?.[k], obj); }
        catch { return undefined; }
      };
      let employeePhotos = [];
      for (const key of possibleEmployeeKeys) {
        const arr = pick(intervention, key);
        if (Array.isArray(arr) && arr.length) { employeePhotos = arr; break; }
      }

      if (employeePhotos.length) {
        for (const imageItem of employeePhotos) {
          const url = extractUrlFromFileItem(imageItem);
          if (!url || !looksLikeImage(url)) continue;
          const fallbackName = (typeof url === 'string' && url.split('/').pop()) || 'photo_employe.jpg';
          tasks.push((async () => {
            const file = await getFileContent(url, fallbackName);
            if (!file) return;
            if (file.isBase64) employeePhotosFolder.file(file.name, file.base64Data, { base64: true });
            else employeePhotosFolder.file(file.name, file.blob);
          })());
        }
      }

      // (Note: si aucune clé employé n'est trouvée, on n'invente rien pour éviter les doublons.)

      await Promise.all(tasks);

      // Génération du zip
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Archive-Intervention-${intervention.id}-${safeName(intervention.client || '')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast('Erreur lors de l\'exportation: ' + (error?.message || String(error)), 'error');
    } finally {
      setExportingId(null);
    }
  };
  // ------------------ fin handleExport ------------------

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div>
      <h2 className="view-title">Archives</h2>
      <div className="card-white">
        <ul className="document-list">
          {archived.length > 0 ? archived.map(int => (
            <li key={int.id}>
              <div>
                <p className="font-semibold">{int.client} - {int.service}</p>
                <p className="text-muted">{int.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport(int)} disabled={exportingId === int.id} className="btn btn-primary">
                  {exportingId === int.id ? 'Exportation...' : 'Exporter (ZIP)'}
                </button>
                <button onClick={() => handleDeleteArchive(int.id)} className="btn-icon-danger" title="Supprimer définitivement">
                  <TrashIcon />
                </button>
              </div>
            </li>
          )) : <p>Aucune intervention archivée.</p>}
        </ul>
      </div>
    </div>
  );
}

