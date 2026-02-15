// src/pages/AdminOrganizationsViewContainer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { organizationService } from '../services/organizationService';
import AdminOrganizationsView from './AdminOrganizationsView';
import logger from '../utils/logger';

const AdminOrganizationsViewContainer = () => {
    const toast = useToast();
    const [organizations, setOrganizations] = useState([]);
    const [memberCounts, setMemberCounts] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const loadOrganizations = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await organizationService.getAllOrganizations();
        if (error) {
            logger.error('Erreur chargement organisations:', error);
            toast?.error('Erreur lors du chargement des organisations');
        } else {
            setOrganizations(data || []);
            // Charger les compteurs de membres en parallèle
            const counts = {};
            await Promise.all(
                (data || []).map(async (org) => {
                    const { count } = await organizationService.getOrganizationMemberCount(org.id);
                    counts[org.id] = count;
                })
            );
            setMemberCounts(counts);
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        loadOrganizations();
    }, [loadOrganizations]);

    const handleCreateOrganization = async (orgData) => {
        const { error } = await organizationService.createOrganization(orgData);
        if (error) {
            logger.error('Erreur création organisation:', error);
            toast?.error('Erreur lors de la création');
            return false;
        }
        toast?.success('Organisation créée avec succès');
        await loadOrganizations();
        return true;
    };

    const handleToggleActive = async (orgId, isActive) => {
        const { error } = await organizationService.toggleOrganizationActive(orgId, isActive);
        if (error) {
            logger.error('Erreur toggle organisation:', error);
            toast?.error('Erreur lors de la modification');
            return;
        }
        toast?.success(isActive ? 'Organisation activée' : 'Organisation désactivée');
        setOrganizations(prev => prev.map(org =>
            org.id === orgId ? { ...org, is_active: isActive } : org
        ));
    };

    const handleUpdateOrganization = async (orgId, updates) => {
        const { error } = await organizationService.updateOrganization(orgId, updates);
        if (error) {
            logger.error('Erreur MAJ organisation:', error);
            toast?.error('Erreur lors de la mise à jour');
            return false;
        }
        toast?.success('Organisation mise à jour');
        await loadOrganizations();
        return true;
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des organisations...</div>
            </div>
        );
    }

    return (
        <AdminOrganizationsView
            organizations={organizations}
            memberCounts={memberCounts}
            onCreateOrganization={handleCreateOrganization}
            onToggleActive={handleToggleActive}
            onUpdateOrganization={handleUpdateOrganization}
        />
    );
};

export default AdminOrganizationsViewContainer;
