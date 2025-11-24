// src/pages/AdminDashboardContainer.js
import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import AdminDashboard from './AdminDashboard';

const AdminDashboardContainer = () => {
    const { interventions, isLoading: interventionsLoading } = useInterventions();
    const { leaveRequests, isLoading: leaveRequestsLoading } = useLeaveRequests();

    if (interventionsLoading || leaveRequestsLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement du dashboard...</div>
            </div>
        );
    }

    return (
        <AdminDashboard
            interventions={interventions}
            leaveRequests={leaveRequests}
        />
    );
};

export default AdminDashboardContainer;
