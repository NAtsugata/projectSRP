import React from 'react';

export default function AdminDashboard({ interventions, leaveRequests }) {
    const pendingLeaves = leaveRequests.filter(r => r.status === 'En attente').length;
    const upcomingInterventions = interventions.filter(i => !i.is_archived).length;
    return (
        <div>
            <h3>Tableau de Bord</h3>
            <div className="grid-2-cols">
                <div className="card-white"><p style={{fontSize: '1.875rem', fontWeight: 'bold'}}>{upcomingInterventions}</p><p className="text-muted">Interventions planifiées</p></div>
                <div className="card-white"><p style={{fontSize: '1.875rem', fontWeight: 'bold'}}>{pendingLeaves}</p><p className="text-muted">Demandes de congés</p></div>
            </div>
        </div>
    );
}