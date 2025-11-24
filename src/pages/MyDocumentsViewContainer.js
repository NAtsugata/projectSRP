// src/pages/MyDocumentsViewContainer.js
import React from 'react';
import { useDocuments } from '../hooks/useDocuments';
import { useUsers } from '../hooks/useUsers';
import { useAuthStore } from '../store/authStore';
import MyDocumentsView from './MyDocumentsView';

const MyDocumentsViewContainer = () => {
    const { profile } = useAuthStore();
    const { users } = useUsers();

    const {
        scannedDocuments,
        isLoading,
        saveDocuments,
        deleteDocument,
        updateDocument,
    } = useDocuments(profile?.is_admin ? null : profile?.id);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des documents...</div>
            </div>
        );
    }

    return (
        <MyDocumentsView
            scannedDocuments={scannedDocuments}
            profile={profile}
            users={users}
            onSaveDocuments={saveDocuments}
            onDeleteDocument={deleteDocument}
            onUpdateDocument={updateDocument}
        />
    );
};

export default MyDocumentsViewContainer;
