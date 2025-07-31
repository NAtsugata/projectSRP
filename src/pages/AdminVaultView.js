import React, { useState, useMemo } from 'react';
// On importe le service de stockage et des icônes pour l'interface
import { storageService } from '../lib/supabase';
import { DownloadIcon, TrashIcon } from '../components/SharedUI'; // Assurez-vous que TrashIcon est disponible

// La vue principale gère maintenant l'état et la logique
export default function AdminVaultView({ users = [], vaultDocuments = [], onSendDocument, onDeleteDocument }) {
  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // On ne garde que les employés qui ne sont pas administrateurs dans la liste
  const employees = useMemo(() => users.filter(u => !u.is_admin), [users]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Pré-remplir le nom du document avec le nom du fichier (sans extension)
      setDocumentName(selectedFile.name.split('.').slice(0, -1).join('.'));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !selectedUserId || !documentName) {
      setError('Veuillez sélectionner un employé, un fichier et donner un nom au document.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // On passe les informations nécessaires à la fonction onSendDocument
      // Cette fonction (à définir dans votre composant parent) doit gérer :
      // 1. L'upload du fichier via storageService
      // 2. La création de l'enregistrement dans votre base de données
      await onSendDocument({ file, userId: selectedUserId, name: documentName });

      // Réinitialiser le formulaire après l'envoi
      setFile(null);
      setDocumentName('');
      setSelectedUserId('');
      event.target.reset(); // Vide le champ de fichier

    } catch (err) {
      console.error('Erreur lors de l\'envoi:', err);
      setError('Une erreur est survenue lors de l\'envoi du document.');
    } finally {
      setIsUploading(false);
    }
  };

  // On regroupe les documents par employé pour l'affichage
  const documentsByUser = useMemo(() => {
    return vaultDocuments.reduce((acc, doc) => {
      const userId = doc.user_id;
      if (!acc[userId]) {
        // On cherche le nom de l'employé pour l'affichage
        const user = users.find(u => u.id === userId);
        acc[userId] = {
          userName: user ? user.full_name : 'Employé inconnu',
          documents: []
        };
      }
      acc[userId].documents.push(doc);
      return acc;
    }, {});
  }, [vaultDocuments, users]);

  return (
    <div>
      <h2 className="view-title">Coffre-fort numérique - Administrateur</h2>

      {/* Section pour envoyer un nouveau document */}
      <div className="card-white mb-6">
        <h3>Envoyer un document</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group">
            <label htmlFor="employee-select">Choisir un employé</label>
            <select
              id="employee-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="form-control"
              required
            >
              <option value="" disabled>Sélectionnez un destinataire</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="document-name">Nom du document</label>
            <input
              id="document-name"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Ex: Fiche de paie - Juillet 2025"
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="file-upload">Fichier</label>
            <input
              id="file-upload"
              type="file"
              onChange={handleFileChange}
              className="form-control"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" className="btn btn-primary w-full" disabled={isUploading}>
            {isUploading ? 'Envoi en cours...' : 'Envoyer le document'}
          </button>
        </form>
      </div>

      {/* Section pour afficher les documents déjà envoyés */}
      <div className="card-white">
        <h3>Documents envoyés</h3>
        <div className="flex flex-col gap-6">
          {Object.keys(documentsByUser).length > 0 ? (
            Object.entries(documentsByUser).map(([userId, data]) => (
              <div key={userId}>
                <h4 className="font-semibold mb-2">{data.userName}</h4>
                <ul className="document-list">
                  {data.documents.map(doc => (
                    <li key={doc.id}>
                      <span>{doc.file_name}</span>
                      <div className="flex items-center gap-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Télécharger">
                          <DownloadIcon />
                        </a>
                        <button onClick={() => onDeleteDocument(doc.id)} className="btn-icon-danger" title="Supprimer">
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-muted">Aucun document n'a encore été envoyé.</p>
          )}
        </div>
      </div>
    </div>
  );
}
