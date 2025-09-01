import React from 'react';
import { GenericStatusBadge, CheckIcon, XIcon, TrashIcon } from '../components/SharedUI';

export default function AdminLeaveView({ leaveRequests, onUpdateStatus, onDelete }) {

    const statusColorMap = {
        "Approuvé": "status-badge-green",
        "En attente": "status-badge-yellow",
        "Rejeté": "status-badge-red"
    };

    return (
        <div>
            <h2 className="view-title">Gestion des Demandes de Congés</h2>

            <div className="card-white">
                {leaveRequests.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {leaveRequests.map(req => (
                            <li key={req.id} className="py-4 flex items-center justify-between space-x-4">
                                <div className="flex-grow">
                                    <p className="font-semibold text-gray-900">{req.user_name || 'Employé inconnu'}</p>
                                    <p className="text-sm text-gray-600">{req.reason}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Du {new Date(req.start_date).toLocaleDateString()} au {new Date(req.end_date).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex-shrink-0 flex items-center space-x-2">
                                    <GenericStatusBadge status={req.status} colorMap={statusColorMap} />

                                    {/* Affiche les boutons uniquement si la demande est 'En attente' */}
                                    {req.status === 'En attente' && (
                                        <>
                                            <button
                                                onClick={() => onUpdateStatus(req.id, 'Approuvé')}
                                                className="btn-icon btn-success"
                                                title="Approuver"
                                            >
                                                <CheckIcon />
                                            </button>
                                            <button
                                                onClick={() => onUpdateStatus(req.id, 'Rejeté')}
                                                className="btn-icon btn-danger"
                                                title="Rejeter"
                                            >
                                                <XIcon />
                                            </button>
                                        </>
                                    )}

                                    <button
                                        onClick={() => onDelete(req.id)}
                                        className="btn-icon btn-secondary"
                                        title="Supprimer"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-4">Aucune demande de congé à afficher.</p>
                )}
            </div>
        </div>
    );
}
