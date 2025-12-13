// =============================
// FILE: src/pages/ContractDetailViewContainer.js
// Container component for Contract Detail View
// =============================
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ContractDetailView from './ContractDetailView';
import {
    useContractWithDetails,
    useUpdateContract,
    useDeleteContract,
    useUpdateVisitStatus,
    useAddEquipment,
    useUpdateEquipment,
    useDeleteEquipment,
    useContractReports,
    useCreateReport,
    useDeleteReport
} from '../hooks/useMaintenanceContracts';
import { useToast } from '../contexts/ToastContext';

function ContractDetailViewContainer() {
    const { contractId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Query pour récupérer le contrat avec tous ses détails
    const {
        data: contractData,
        isLoading,
        error
    } = useContractWithDetails(contractId);

    // Query pour les rapports
    const { data: reports = [] } = useContractReports(contractId);

    // Mutations contrat
    const updateContract = useUpdateContract();
    const deleteContract = useDeleteContract();
    const updateVisitStatus = useUpdateVisitStatus();

    // Mutations équipements
    const addEquipment = useAddEquipment();
    const updateEquipment = useUpdateEquipment();
    const deleteEquipmentMutation = useDeleteEquipment();

    // Mutation rapport
    const createReport = useCreateReport();
    const deleteReport = useDeleteReport();

    // Handler pour édition (navigation vers le formulaire)
    const handleEdit = (contract) => {
        navigate('/contracts', {
            state: {
                editContract: contract
            }
        });
    };

    // Handler pour suppression
    const handleDelete = async (id) => {
        await deleteContract.mutateAsync(id);
    };

    // Handler pour mise à jour statut visite
    const handleUpdateVisitStatus = async ({ visitId, status, notes }) => {
        await updateVisitStatus.mutateAsync({ visitId, status, notes });
    };

    // Equipment handlers
    const handleAddEquipment = async (data) => {
        await addEquipment.mutateAsync({ contractId, data });
        showToast('Équipement ajouté avec succès', 'success');
    };

    const handleUpdateEquipment = async (equipmentId, updates) => {
        await updateEquipment.mutateAsync({ equipmentId, updates, contractId });
        showToast('Équipement modifié avec succès', 'success');
    };

    const handleDeleteEquipment = async (equipmentId) => {
        await deleteEquipmentMutation.mutateAsync({ equipmentId, contractId });
        showToast('Équipement supprimé', 'success');
    };

    // Report handler
    const handleCreateReport = async (reportData) => {
        await createReport.mutateAsync({ contractId, reportData });
        showToast('Rapport enregistré avec succès', 'success');
    };

    const handleDeleteReport = async (reportId) => {
        await deleteReport.mutateAsync(reportId);
        showToast('Rapport supprimé', 'success');
    };

    return (
        <ContractDetailView
            contract={contractData}
            visits={contractData?.visits || []}
            equipment={contractData?.equipment || []}
            history={contractData?.history || []}
            reports={reports}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateVisitStatus={handleUpdateVisitStatus}
            onAddEquipment={handleAddEquipment}
            onUpdateEquipment={handleUpdateEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            onCreateReport={handleCreateReport}
            onDeleteReport={handleDeleteReport}
            isAddingEquipment={addEquipment.isPending}
            isUpdatingEquipment={updateEquipment.isPending}
            isCreatingReport={createReport.isPending}
        />
    );
}

export default ContractDetailViewContainer;

