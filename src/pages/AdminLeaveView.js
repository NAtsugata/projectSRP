import React from 'react';
import { GenericStatusBadge } from '../components/SharedUI';
import { CheckIcon, XIcon, TrashIcon } from '../components/SharedUI';

export default function AdminLeaveView({ leaveRequests, onUpdateRequestStatus, onDeleteLeaveRequest }) {
    const statusColorMap = { "Approuvé": "status-badge-green", "En attente": "status-badge-yellow", "Rejeté": "status-badge-red" };
    return (
        <div>
            <h3>Gestion des Congés</h3>
            <div className="card-white">
                <ul className="document-list">
                    {leaveRequests.map(req => (
                        <li key={req.id}>
                            <div><p className="font-semibold">{req.user_name} - <span style={{fontWeight: 'normal'}}>{req.reason}</span></p><p className="text-muted">Du {req.start_date} au {req.end_date}</p></div>
                            <div className="flex items-center gap-4 mt-2">
                                <GenericStatusBadge status={req.status} colorMap={statusColorMap}/>
                                {req.status === 'En attente' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => onUpdateRequestStatus(req.id, 'Approuvé')} className="btn-icon-success"><CheckIcon/></button>
                                        <button onClick={() => onUpdateRequestStatus(req.id, 'Rejeté')} className="btn-icon-danger"><XIcon/></button>
                                    </div>
                                )}
                                <button onClick={() => onDeleteLeaveRequest(req.id)} className="btn-icon-danger"><TrashIcon/></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}