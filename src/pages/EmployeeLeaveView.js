import React, { useState } from 'react';
import { GenericStatusBadge, PlusIcon } from '../components/SharedUI';

export default function EmployeeLeaveView({ leaveRequests, onSubmitRequest, userName, userId, showToast }) {
    const [showForm, setShowForm] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        if(!startDate || !endDate || !reason) {
            showToast("Veuillez remplir tous les champs.", "error");
            return;
        }
        onSubmitRequest({ userName, userId, startDate, endDate, reason });
        setShowForm(false);
        setStartDate(''); setEndDate(''); setReason('');
    };
    const statusColorMap = { "Approuvé": "status-badge-green", "En attente": "status-badge-yellow", "Rejeté": "status-badge-red" };
    return (
        <div>
            <div className="flex-between mb-6">
                <h2 className="view-title">Vos Demandes de Congés</h2>
                <button onClick={() => setShowForm(!showForm)} className="btn btn-primary flex-center"><PlusIcon/>{showForm ? 'Annuler' : 'Nouvelle Demande'}</button>
            </div>
            {showForm && (
                <form onSubmit={handleSubmit} className="card-white mb-6">
                    <h3>Nouvelle demande</h3>
                    <div className="grid-2-cols">
                        <div className="form-group"><label>Date de début</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="form-control"/></div>
                        <div className="form-group"><label>Date de fin</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="form-control"/></div>
                    </div>
                    <div className="form-group"><label>Motif</label><textarea value={reason} onChange={e => setReason(e.target.value)} required rows="3" className="form-control"></textarea></div>
                    <button type="submit" className="btn btn-success w-full">Envoyer</button>
                </form>
            )}
            <div className="card-white">
                <h3>Historique</h3>
                <ul className="document-list">
                    {leaveRequests.map(req => (<li key={req.id}><div><p className="font-semibold">{req.reason}</p><p className="text-muted">Du {req.start_date} au {req.end_date}</p></div><GenericStatusBadge status={req.status} colorMap={statusColorMap} /></li>))}
                </ul>
            </div>
        </div>
    );
}
