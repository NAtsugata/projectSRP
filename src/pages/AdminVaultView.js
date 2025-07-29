// Ce code remplace le contenu de votre fichier existant, par exemple :
// /src/pages/AdminVaultView.js

import React, { useState, useRef } from 'react';

// J'ai créé un composant réutilisable pour la clarté,
// mais vous pouvez intégrer cette logique directement dans votre page.
function FileUploader() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [error, setError] = useState(null);

  // useRef permet de garder une référence à l'input de type fichier
  // pour pouvoir le réinitialiser après un envoi réussi.
  const inputFileRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null); // Réinitialise l'erreur si un nouveau fichier est choisi
    }
  };

  const handleSubmit = async (event) => {
    // CORRECTION N°2 : Ligne cruciale qui empêche la page de se recharger sur mobile
    event.preventDefault();

    if (!file) {
      setError('Veuillez sélectionner un fichier avant de l\'envoyer.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // On envoie le fichier à notre mini-serveur /api/upload
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      });

      if (!response.ok) {
        throw new Error(`L'envoi a échoué: ${response.statusText}`);
      }

      const newBlob = await response.json();

      // On sauvegarde l'URL permanente pour l'afficher
      setUploadedFileUrl(newBlob.url);
      setFile(null); // Réinitialise le state du fichier
      if (inputFileRef.current) {
        inputFileRef.current.value = ""; // Réinitialise le champ de l'input
      }

    } catch (err) {
      console.error('Erreur lors de l\'upload:', err);
      setError('Une erreur est survenue lors de l\'envoi du fichier.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', maxWidth: '500px', margin: '20px auto' }}>
      <form onSubmit={handleSubmit}>
        <h4>Envoyer un nouveau document</h4>
        <input
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
          ref={inputFileRef} // On lie la référence à l'input
          style={{ marginBottom: '10px', display: 'block' }}
        />
        <button type="submit" disabled={uploading || !file} style={{ padding: '10px 15px', cursor: 'pointer' }}>
          {uploading ? 'Envoi en cours...' : 'Envoyer le fichier'}
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

      {uploadedFileUrl && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ color: 'green' }}>Fichier envoyé avec succès !</p>
          {/* Affiche une image ou un lien selon le type de fichier */}
          {file?.type.startsWith('image/') ? (
             <img src={uploadedFileUrl} alt="Aperçu de l'upload" style={{ maxWidth: '100%', borderRadius: '4px' }} />
          ) : (
            <p>Le document est disponible ici :</p>
          )}
          <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>{uploadedFileUrl}</a>
        </div>
      )}
    </div>
  );
}


// Votre vue principale peut maintenant utiliser ce composant
export default function AdminVaultView() {
  return (
    <div>
      <h2>Coffre-fort numérique - Administrateur</h2>
      <p>Gérez ici les documents importants.</p>

      {/* Intégration du composant d'upload */}
      <FileUploader />

      {/* Le reste de votre page... */}
    </div>
  );
}
