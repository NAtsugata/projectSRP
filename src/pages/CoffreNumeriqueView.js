import React from 'react';

// MODIFIÉ: Le composant accepte maintenant "vaultDocuments" au lieu de "payslips"
export default function CoffreNumeriqueView({ vaultDocuments }) {
    return (
        <div>
            <h2 className="view-title">Votre Coffre-fort</h2>
            <div className="card-white">
                <h3>Vos documents</h3>
                <ul className="document-list">
                    {/* On vérifie s'il y a des documents */}
                    {vaultDocuments && vaultDocuments.length > 0 ? vaultDocuments.map(doc =>
                        <li key={doc.id}>
                            {/* On affiche le nom du fichier */}
                            <span>{doc.file_name}</span>
                            {/* Le lien pointe vers l'URL du fichier */}
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                        </li>
                    ) : <p className="text-muted">Aucun document.</p>}
                </ul>
            </div>
        </div>
    );
}
