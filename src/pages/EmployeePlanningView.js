import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GenericStatusBadge } from '../components/SharedUI';

export default function EmployeePlanningView({ interventions }) {
    const navigate = useNavigate();
    return (
        <div>
            <h2 className="view-title">Votre Planning</h2>
            {interventions.length > 0 ? interventions.map(int => (
                <div key={int.id} onClick={() => navigate('/planning/' + int.id)} className="intervention-list-item-clickable">
                    <div style={{padding: '1rem'}}>
                        <div className="flex-between">
                            <div><p className="font-semibold">{int.client}</p><p className="text-muted">{int.service}</p></div>
                            <GenericStatusBadge status={int.status} colorMap={{ "À venir": "status-badge-blue", "Terminée": "status-badge-green" }}/>
                        </div>
                        <p className="text-muted mt-2">{int.date} à {int.time}</p>
                    </div>
                </div>
            )) : <div className="card-white" style={{textAlign: 'center'}}><p>Aucune intervention planifiée.</p></div>}
        </div>
    );
}