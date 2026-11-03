// src/pages/MyDocumentsViewContainer.js
import { useDocuments } from '../hooks/useDocuments';
import { useUsers } from '../hooks/useUsers';
import { useAuthStore } from '../store/authStore';
import MyDocumentsView from './MyDocumentsView';

const MyDocumentsViewContainer = () => {
    const { profile, loading: authLoading } = useAuthStore();
    const { users } = useUsers();

    const {
        scannedDocuments,
        isLoading: docsLoading,
        saveDocuments,
        deleteDocument,
        updateDocument,
        error,
        refetch,
    } = useDocuments(profile?.is_admin ? null : profile?.id);

    if (authLoading || docsLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des documents...</div>
            </div>
        );
    }

    if (error) return <section role="alert"><h2>Documents indisponibles</h2><p>Impossible de charger vos documents. Réessayez avant de scanner.</p><button type="button" onClick={()=>refetch()}>Réessayer</button></section>;
    return (
        <MyDocumentsView
            key={`${profile?.organization_id}:${profile?.id}:${profile?.is_admin}`}
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
