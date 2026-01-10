// src/pages/ChecklistViewContainer.js
import React from 'react';
import { useChecklists } from '../hooks/useChecklists';
import { useInterventions } from '../hooks/useInterventions';
import { useAuthStore } from '../store/authStore';
import ChecklistView from './ChecklistView';

const ChecklistViewContainer = () => {
    const { profile } = useAuthStore();
    const { checklists, templates, isLoading, updateChecklist } = useChecklists(profile?.id);
    const { interventions } = useInterventions(profile?.id);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des checklists...</div>
            </div>
        );
    }

    return (
        <ChecklistView
            checklists={checklists}
            templates={templates}
            interventions={interventions}
            onUpdateChecklist={updateChecklist}
            profile={profile}
        />
    );
};

export default ChecklistViewContainer;
