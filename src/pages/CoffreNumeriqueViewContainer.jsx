// src/pages/CoffreNumeriqueViewContainer.js
import React from 'react';
import { useVault } from '../hooks/useVault';
import { useAuthStore } from '../store/authStore';
import CoffreNumeriqueView from './CoffreNumeriqueView';

const CoffreNumeriqueViewContainer = () => {
    const { profile } = useAuthStore();
    const { vaultDocuments, isLoading } = useVault(profile?.id);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement du coffre-fort...</div>
            </div>
        );
    }

    return <CoffreNumeriqueView vaultDocuments={vaultDocuments} />;
};

export default CoffreNumeriqueViewContainer;
