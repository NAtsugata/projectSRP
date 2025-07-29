import React from 'react';

export default function CoffreNumeriqueView({ payslips }) {
    return (
        <div>
            <h2 className="view-title">Votre Coffre-fort</h2>
            <div className="card-white">
                <h3>Vos documents</h3>
                <ul className="document-list">
                    {payslips.length > 0 ? payslips.map(doc => 
                        <li key={doc.id}>
                            <span>{doc.name}</span>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                        </li>
                    ) : <p className="text-muted">Aucun document.</p>}
                </ul>
            </div>
        </div>
    );
}