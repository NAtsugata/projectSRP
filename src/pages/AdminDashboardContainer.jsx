// src/pages/AdminDashboardContainer.js
import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { useExpiringContracts, useUpcomingVisits } from '../hooks/useMaintenanceContracts';
import AdminDashboard from './AdminDashboard';

const AdminDashboardContainer = () => {
    const { interventions, isLoading: interventionsLoading } = useInterventions();
    const { leaveRequests, isLoading: leaveRequestsLoading } = useLeaveRequests();
    const { data: expiringContracts = [] } = useExpiringContracts(30);
    const { data: upcomingVisits = [] } = useUpcomingVisits(7);

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
            expiringContracts={expiringContracts}
            upcomingVisits={upcomingVisits}
        />
    );
};

export default AdminDashboardContainer;

