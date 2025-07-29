import React from 'react';

export default function AgendaView({ interventions }) {
    const interventionsByDate = interventions.reduce((acc, int) => {
        (acc[int.date] = acc[int.date] || []).push(int);
        return acc;
    }, {});
    return (
        <div>
            <h2 className="view-title">Agenda</h2>
            {Object.keys(interventionsByDate).sort().map(date => (
                <div key={date} className="mb-6">
                    <h3 className="font-semibold text-lg mb-2">{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                    <div className="card-white">
                        <ul className="document-list">
                            {interventionsByDate[date].map(int => (
                                <li key={int.id}>
                                    <div>
                                        <p className="font-semibold">{int.client}</p>
                                        <p className="text-muted">{int.service} à {int.time}</p>
                                    </div>
                                    <p className="text-muted">
                                        Avec : {int.intervention_assignments.map(a => a.profiles.full_name).join(', ') || 'Personne'}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ))}
        </div>
    );
}