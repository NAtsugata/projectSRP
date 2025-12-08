// =============================
// FILE: src/pages/AdminContractsViewContainer.js
// Container component for Admin Contracts View
// =============================
import React from 'react';
import AdminContractsView from './AdminContractsView';
import {
    useContracts,
    useContractStats,
    useCreateContract,
    useUpdateContract,
    useDeleteContract
} from '../hooks/useMaintenanceContracts';
import { useToast } from '../contexts/ToastContext';

function AdminContractsViewContainer() {
    const { showToast } = useToast();

    // Queries
    const {
        data: contracts = [],
        isLoading,
        error
    } = useContracts();

    const { data: stats } = useContractStats();

    // Mutations
    const createContract = useCreateContract();
    const updateContract = useUpdateContract();
    const deleteContract = useDeleteContract();

    // Handlers
    const handleCreateContract = async (contractData) => {
        await createContract.mutateAsync(contractData);
    };

    const handleUpdateContract = async ({ id, updates }) => {
        await updateContract.mutateAsync({ id, updates });
    };

    const handleDeleteContract = async (id) => {
        await deleteContract.mutateAsync(id);
    };

    return (
        <AdminContractsView
            contracts={contracts}
            stats={stats}
            isLoading={isLoading}
            error={error}
            onCreateContract={handleCreateContract}
            onUpdateContract={handleUpdateContract}
            onDeleteContract={handleDeleteContract}
            showToast={showToast}
        />
    );
}

export default AdminContractsViewContainer;
