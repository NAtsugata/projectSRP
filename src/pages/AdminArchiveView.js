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
            setArchived(data);
        }
        setLoading(false);
    }, [showToast]);
    useEffect(() => {
        fetchArchived();
    }, [fetchArchived]);
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
    const handleExport = async (intervention) => {
        setExportingId(intervention.id);
        if (typeof window.jspdf === 'undefined' || typeof window.JSZip === 'undefined') {
            showToast("Librairies d'exportation manquantes.", "error");
            setExportingId(null);
            return;
        }
        showToast("Préparation de l'export... Veuillez patienter.");
        try {
            const { jsPDF } = window.jspdf;
            const JSZip = window.JSZip;
            const doc = new jsPDF();
            doc.text('Rapport d\'intervention - ' + intervention.client, 10, 10);
            doc.text('Date: ' + intervention.date, 10, 20);
            doc.text('Service: ' + intervention.service, 10, 30);
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
                doc.addImage(intervention.report.signature, 'PNG', 10, yPos + 5, 180, 80);
            }
            const zip = new JSZip();
            zip.file("Rapport.pdf", doc.output('blob'));
            const fetchBlob = async (url, defaultName) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
                    return await response.blob();
                } catch (e) {
                    showToast('Impossible de télécharger le fichier : ' + defaultName, 'error');
                    return null;
                }
            };
            const briefingFolder = zip.folder("documents_preparation");
            for (const doc of intervention.intervention_briefing_documents) {
                const blob = await fetchBlob(doc.file_url, doc.file_name);
                if (blob) briefingFolder.file(doc.file_name, blob);
            }
            const photosFolder = zip.folder("photos_chantier");
            if (intervention.report?.images) {
                for (const imageUrl of intervention.report.images) {
                    const blob = await fetchBlob(imageUrl, imageUrl.split('/').pop());
                    if (blob) photosFolder.file(imageUrl.split('/').pop(), blob);
                }
            }
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = 'Archive-Intervention-' + intervention.id + '-' + intervention.client + '.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            showToast('Erreur lors de l\'exportation: ' + error.message, "error");
        } finally {
            setExportingId(null);
        }
    };
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