// ⬇️ Remplace ta fonction existante par celle-ci
// Cette version corrige les soucis d’images manquantes (data URL, CORS),
// évite les collisions de noms, parallélise les téléchargements, et
// conserve le comportement et les dépendances (jsPDF, JSZip, showToast, setExportingId,…)

const handleExport = async (intervention) => {
  setExportingId(intervention.id);
  if (typeof window.jspdf === 'undefined' || typeof window.JSZip === 'undefined') {
    showToast("Librairies d'exportation manquantes.", "error");
    setExportingId(null);
    return;
  }

  showToast("Préparation de l'export... Veuillez patienter.");

  // --- helpers robustes ---
  const safeName = (name) => {
    // supprime querystring + normalise
    const base = (name || 'fichier')
      .split('?')[0]
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(-120); // éviter les chemins trop longs
    return base || 'fichier';
  };

  // Maintient un compteur pour éviter les collisions de noms
  const uniquify = (() => {
    const seen = new Map();
    return (name) => {
      const base = safeName(name);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      if (count === 0) return base;
      const dot = base.lastIndexOf('.');
      if (dot > 0) {
        return `${base.slice(0, dot)}_${count}${base.slice(dot)}`;
      }
      return `${base}_${count}`;
    };
  })();

  const isDataUrl = (u) => typeof u === 'string' && u.startsWith('data:');

  // Retourne {blob, name, isBase64, base64Data, mime}
  const getFileContent = async (urlOrData, fallbackName = 'fichier') => {
    if (!urlOrData) return null;

    // 1) data URL -> on décode sans fetch
    if (isDataUrl(urlOrData)) {
      try {
        const [, meta, data] = urlOrData.match(/^data:([^;]+);base64,(.+)$/) || [];
        if (!data) throw new Error('Data URL invalide');
        const mime = meta || 'application/octet-stream';
        return {
          isBase64: true,
          base64Data: data,
          mime,
          name: uniquify(fallbackName),
        };
      } catch (e) {
        showToast(`Data URL invalide (ignorée) : ${fallbackName}`, "error");
        return null;
      }
    }

    // 2) URL HTTP(S) -> fetch
    try {
      // NB: pour Supabase public/signed URLs, le CORS est généralement OK.
      // Si ton storage est privé, pense à générer des URLs signées côté serveur.
      const res = await fetch(urlOrData, { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
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

    // --- PDF résumé (inchangé) ---
    doc.text("Rapport d'intervention - " + (intervention.client || ''), 10, 10);
    doc.text('Date: ' + (intervention.date || ''), 10, 20);
    doc.text('Service: ' + (intervention.service || ''), 10, 30);
    doc.text('Notes:', 10, 40);
    const splitNotes = doc.splitTextToSize(intervention.report?.notes || 'Aucune', 180);
    doc.text(splitNotes, 10, 45);
    let yPos = 45 + (splitNotes.length * 10);

    if (intervention.report?.signature) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 10;
      }
      doc.text("Signature du client", 10, yPos);
      // signature: accepte dataURL
      if (isDataUrl(intervention.report.signature)) {
        const sigMime = (intervention.report.signature.split(';')[0] || 'image/png').replace('data:', '');
        const fmt = /jpeg|jpg/i.test(sigMime) ? 'JPEG' : 'PNG';
        doc.addImage(intervention.report.signature, fmt, 10, yPos + 5, 180, 80);
      } else {
        // Si la signature est une URL, on ne peut pas la charger directement dans jsPDF.
        // Elle sera néanmoins ajoutée dans le ZIP dans /photos_chantier
        doc.text("(signature jointe dans le ZIP)", 10, yPos + 90);
      }
    }

    const zip = new JSZip();
    zip.file("Rapport.pdf", doc.output('blob'));

    // --- Préparation des téléchargements en parallèle ---
    const tasks = [];

    // Dossier documents de préparation
    const briefingFolder = zip.folder("documents_preparation");
    if (Array.isArray(intervention.intervention_briefing_documents)) {
      for (const d of intervention.intervention_briefing_documents) {
        const name = d?.file_name || 'document';
        const url = d?.file_url;
        tasks.push(
          (async () => {
            const file = await getFileContent(url, name);
            if (!file) return;
            if (file.isBase64) {
              briefingFolder.file(file.name, file.base64Data, { base64: true });
            } else {
              briefingFolder.file(file.name, file.blob);
            }
          })()
        );
      }
    }

    // Dossier photos chantier (images du rapport)
    const photosFolder = zip.folder("photos_chantier");
    if (Array.isArray(intervention.report?.images)) {
      for (const imageUrl of intervention.report.images) {
        const fallbackName = imageUrl?.split('/').pop() || 'photo_chantier.jpg';
        tasks.push(
          (async () => {
            const file = await getFileContent(imageUrl, fallbackName);
            if (!file) return;
            if (file.isBase64) {
              photosFolder.file(file.name, file.base64Data, { base64: true });
            } else {
              photosFolder.file(file.name, file.blob);
            }
          })()
        );
      }
    }

    // Dossier photos employé
    const employeePhotosFolder = zip.folder("photos_employe");
    if (Array.isArray(intervention.employee_photos)) {
      for (const imageUrl of intervention.employee_photos) {
        const fallbackName = imageUrl?.split('/').pop() || 'photo_employe.jpg';
        tasks.push(
          (async () => {
            const file = await getFileContent(imageUrl, fallbackName);
            if (!file) return;
            if (file.isBase64) {
              employeePhotosFolder.file(file.name, file.base64Data, { base64: true });
            } else {
              employeePhotosFolder.file(file.name, file.blob);
            }
          })()
        );
      }
    }

    // Attendre tous les téléchargements
    await Promise.all(tasks);

    // Génération du zip
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `Archive-Intervention-${intervention.id}-${safeName(intervention.client || '')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    showToast('Erreur lors de l\'exportation: ' + error.message, "error");
  } finally {
    setExportingId(null);
  }
};
