// src/pages/AdminDashboardContainer.js
import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { useUsers } from '../hooks/useUsers';
import { useExpenses } from '../hooks/useExpenses';
import { useContracts, useExpiringContracts, useUpcomingVisits } from '../hooks/useMaintenanceContracts';
import { getCurrentFicheInfo } from '../utils/cerfaService';
import AdminDashboard from './AdminDashboard';

const AdminDashboardContainer = () => {
    const { interventions, isLoading: interventionsLoading } = useInterventions();
    const { leaveRequests, isLoading: leaveRequestsLoading } = useLeaveRequests();
    const { users } = useUsers();
    const { expenses } = useExpenses();
    const { data: contracts = [] } = useContracts();
    const { data: expiringContracts = [] } = useExpiringContracts(30);
    const { data: upcomingVisits = [] } = useUpcomingVisits(7);

    // Compteur CERFA depuis localStorage
    const cerfaInfo = getCurrentFicheInfo();

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
            users={users}
            expenses={expenses}
            contracts={contracts}
            expiringContracts={expiringContracts}
            upcomingVisits={upcomingVisits}
            cerfaCount={cerfaInfo.count}
        />
    );
};

export default AdminDashboardContainer;
