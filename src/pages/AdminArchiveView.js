// =============================
// FILE: src/pages/AdminArchiveView.js — FULL
// Adds Supply Requests summary to exported PDF
// =============================
import React, { useState } from 'react';

import { TrashIcon } from '../components/SharedUI';

export default function AdminArchiveView({ showToast, showConfirmationModal, archivedInterventions = [], isLoading, onDelete }) {
  const [exportingId, setExportingId] = useState(null);

  const handleDeleteArchive = (id) => {
    showConfirmationModal({
      title: "Supprimer l'archive définitivement ?",
      message: "Cette action est irréversible.",
      onConfirm: () => onDelete(id)
    });
  };

  const handleExport = async (intervention) => {
    setExportingId(intervention.id);
    if (typeof window.jspdf === 'undefined' || typeof window.JSZip === 'undefined') { showToast("Librairies d'exportation manquantes.", "error"); setExportingId(null); return; }
    showToast("Préparation de l'export... Veuillez patienter.");

    const isDataUrl = (u) => typeof u === 'string' && u.startsWith('data:');
    const safeName = (name) => { const base = (name || 'fichier').split('?')[0].replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120); return base || 'fichier'; };
    const uniquify = (() => { const seen = new Map(); return (name) => { const base = safeName(name); const count = seen.get(base) || 0; seen.set(base, count + 1); if (count === 0) return base; const dot = base.lastIndexOf('.'); return dot > 0 ? `${base.slice(0, dot)}_${count}${base.slice(dot)}` : `${base}_${count}`; }; })();
    const extractUrl = (item) => { if (!item) return null; if (typeof item === 'string') return item; return item.url || item.file_url || item.path || null; };
    const isImg = (u) => typeof u === 'string' && (u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u));

    const getFileContent = async (urlOrData, fallbackName = 'fichier') => {
      if (!urlOrData) return null;
      if (isDataUrl(urlOrData)) {
        try { const [, meta, data] = urlOrData.match(/^data:([^;]+);base64,(.+)$/) || []; if (!data) throw new Error('Data URL invalide'); const mime = meta || 'application/octet-stream'; return { isBase64: true, base64Data: data, mime, name: uniquify(fallbackName) }; }
        catch (e) { showToast(`Data URL invalide (ignorée) : ${fallbackName}`, 'error'); return null; }
      }
      try { const res = await fetch(urlOrData, { method: 'GET', cache: 'no-store' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const blob = await res.blob(); const name = uniquify(urlOrData.split('/').pop() || fallbackName); return { blob, name }; }
      catch (e) { showToast(`Impossible de télécharger: ${fallbackName} (${e.message})`, 'error'); return null; }
    };

    try {
      const { jsPDF } = window.jspdf; const JSZip = window.JSZip; const doc = new jsPDF();
      const title = `Rapport d'intervention - ${intervention.client || ''}`;
      doc.setFontSize(14); doc.text(title, 10, 10);
      doc.setFontSize(11); doc.text('Date: ' + (intervention.date || ''), 10, 20); doc.text('Service: ' + (intervention.service || ''), 10, 27);

      let y = 36;
      doc.text('Notes:', 10, y); y += 6;
      const notes = doc.splitTextToSize(intervention.report?.notes || 'Aucune', 180); doc.text(notes, 10, y); y += notes.length * 6 + 2;

      // Résumé besoins & demandes
      const needs = Array.isArray(intervention.report?.needs) ? intervention.report.needs : [];
      const requests = Array.isArray(intervention.report?.supply_requests) ? intervention.report.supply_requests : [];
      if (needs.length) {
        if (y > 250) { doc.addPage(); y = 10; }
        doc.text('Besoins chantier:', 10, y); y += 6;
        for (const n of needs) {
          const line = `• [${n.category || '—'}] ${n.label}${n.qty ? ' × ' + n.qty : ''}${n.urgent ? ' [URGENT]' : ''}${typeof n.estimated_price === 'number' ? ' — ' + n.estimated_price.toFixed(2) + ' €' : ''}${n.note ? ' — ' + n.note : ''}${n.request_id ? ' — req: ' + n.request_id : ''}`;
          const t = doc.splitTextToSize(line, 180); if (y + t.length * 6 > 280) { doc.addPage(); y = 10; } doc.text(t, 10, y); y += t.length * 6;
        }
      }
      if (requests.length) {
        if (y > 250) { doc.addPage(); y = 10; }
        doc.text('Demandes de fourniture:', 10, y); y += 6;
        for (const r of requests) {
          const head = `#${r.id} — ${new Date(r.created_at).toLocaleString('fr-FR')} — ${r.status}${r.vendor ? ' — ' + r.vendor : ''}`;
          const ht = doc.splitTextToSize(head, 180); if (y + ht.length * 6 > 280) { doc.addPage(); y = 10; } doc.text(ht, 10, y); y += ht.length * 6;
          for (const i of r.items || []) {
            const line = `   · ${i.label} × ${i.qty || 1} — ${i.category || '—'}${typeof i.estimated_price === 'number' ? ' — ' + i.estimated_price.toFixed(2) + ' €' : ''}${i.note ? ' — ' + i.note : ''}`;
            const t = doc.splitTextToSize(line, 180); if (y + t.length * 6 > 280) { doc.addPage(); y = 10; } doc.text(t, 10, y); y += t.length * 6;
          }
          const total = (r.total || (r.items || []).reduce((s, i) => s + (Number(i.estimated_price) || 0), 0)).toFixed(2) + ' €';
          const tt = doc.splitTextToSize('   Total estimé: ' + total, 180); if (y + tt.length * 6 > 280) { doc.addPage(); y = 10; } doc.text(tt, 10, y); y += tt.length * 6;
        }
      }

      if (intervention.report?.signature) {
        if (y > 200) { doc.addPage(); y = 10; }
        doc.text('Signature du client', 10, y);
        if (isDataUrl(intervention.report.signature)) {
          const sigMime = (intervention.report.signature.split(';')[0] || 'image/png').replace('data:', '');
          const fmt = /jpeg|jpg/i.test(sigMime) ? 'JPEG' : 'PNG';
          doc.addImage(intervention.report.signature, fmt, 10, y + 5, 180, 80);
        } else {
          doc.text('(signature jointe dans le ZIP)', 10, y + 90);
        }
      }

      const zip = new JSZip(); zip.file('Rapport.pdf', doc.output('blob'));

      const tasks = [];
      const briefingFolder = zip.folder('documents_preparation');
      if (Array.isArray(intervention.intervention_briefing_documents)) {
        for (const d of intervention.intervention_briefing_documents) {
          const name = d?.file_name || 'document'; const url = d?.file_url;
          tasks.push((async () => { const file = await getFileContent(url, name); if (!file) return; if (file.isBase64) briefingFolder.file(file.name, file.base64Data, { base64: true }); else briefingFolder.file(file.name, file.blob); })());
        }
      }

      const photosFolder = zip.folder('photos_chantier');
      const reportImages = Array.isArray(intervention?.report?.files) ? intervention.report.files.map(extractUrl).filter(u => u && isImg(u)) : [];
      for (const imageUrl of reportImages) {
        const fallbackName = (typeof imageUrl === 'string' && imageUrl.split('/').pop()) || 'photo_chantier.jpg';
        tasks.push((async () => { const file = await getFileContent(imageUrl, fallbackName); if (!file) return; if (file.isBase64) photosFolder.file(file.name, file.base64Data, { base64: true }); else photosFolder.file(file.name, file.blob); })());
      }

      const employeePhotosFolder = zip.folder('photos_employe');
      const possibleEmployeeKeys = ['employee_photos', 'employeePhotos', 'photos_employee', 'photosEmploye', 'report.employee_photos', 'report.employeePhotos'];
      const pick = (obj, path) => { try { return path.split('.').reduce((acc, k) => acc?.[k], obj); } catch { return undefined; } };
      let employeePhotos = [];
      for (const key of possibleEmployeeKeys) { const arr = pick(intervention, key); if (Array.isArray(arr) && arr.length) { employeePhotos = arr; break; } }
      if (employeePhotos.length) {
        for (const imageItem of employeePhotos) {
          const url = extractUrl(imageItem); if (!url || !isImg(url)) continue;
          const fallbackName = (typeof url === 'string' && url.split('/').pop()) || 'photo_employe.jpg';
          tasks.push((async () => { const file = await getFileContent(url, fallbackName); if (!file) return; if (file.isBase64) employeePhotosFolder.file(file.name, file.base64Data, { base64: true }); else employeePhotosFolder.file(file.name, file.blob); })());
        }
      }

      await Promise.all(tasks);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Archive-Intervention-${intervention.id}-${safeName(intervention.client || '')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href); // ✅ Nettoyage mémoire
    } catch (error) {
      showToast('Erreur lors de l\'exportation: ' + (error?.message || String(error)), 'error');
    } finally { setExportingId(null); }
  };

  if (isLoading) return <div className="loading-spinner"></div>;
  return (
    <div>
      <h2 className="view-title">Archives</h2>
      <div className="card-white">
        <ul className="document-list">
          {archivedInterventions.length > 0 ? archivedInterventions.map(int => (
            <li key={int.id}>
              <div>
                <p className="font-semibold">{int.client} - {int.service}</p>
                <p className="text-muted">{int.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport(int)} disabled={exportingId === int.id} className="btn btn-primary">{exportingId === int.id ? 'Exportation...' : 'Exporter (ZIP)'}</button>
                <button onClick={() => handleDeleteArchive(int.id)} className="btn-icon-danger" title="Supprimer définitivement"><TrashIcon /></button>
              </div>
            </li>
          )) : <p>Aucune intervention archivée.</p>}
        </ul>
      </div>
    </div>
  );
}
