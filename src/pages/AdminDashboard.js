import React, { useMemo } from 'react';

// Composant skeleton pour le chargement
const DashboardSkeleton = () => (
    <div className="page-loading-skeleton">
        <div className="skeleton-item large"></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div className="skeleton-item large"></div>
            <div className="skeleton-item large"></div>
        </div>
        <div className="skeleton-item"></div>
        <div className="skeleton-item small"></div>
    </div>
);

export default function AdminDashboard({
    interventions,
    leaveRequests,
    isLoading,
    loadingState
}) {
    // Valeurs par défaut sécurisées
    const defaultInterventions = interventions || [];
    const defaultLeaveRequests = leaveRequests || [];
    const defaultLoadingState = loadingState || {};
    const defaultIsLoading = Boolean(isLoading);

    // Mémorisation des données sécurisées
    const safeInterventions = useMemo(() => {
        return Array.isArray(defaultInterventions) ? defaultInterventions : [];
    }, [defaultInterventions]);

    const safeLeaveRequests = useMemo(() => {
        return Array.isArray(defaultLeaveRequests) ? defaultLeaveRequests : [];
    }, [defaultLeaveRequests]);

    // Détection mobile
    const isMobile = useMemo(() => {
        return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    }, []);

    // États de chargement
    const isInterventionsLoading = defaultLoadingState.interventions === 'loading' || defaultLoadingState.interventions === 'idle';
    const isLeavesLoading = defaultLoadingState.leaves === 'loading' || defaultLoadingState.leaves === 'idle';
    const isAnyDataLoading = isInterventionsLoading || isLeavesLoading;

    // Affichage du skeleton pendant le chargement initial
    if (defaultIsLoading && safeInterventions.length === 0 && safeLeaveRequests.length === 0) {
        return (
            <div>
                <h3>Tableau de Bord</h3>
                {isMobile && (
                    <div className="mobile-admin-notice">
                        📱 Chargement optimisé pour mobile admin...
                    </div>
                )}
                <DashboardSkeleton />
            </div>
        );
    }

    // Calculs des statistiques
    const stats = useMemo(() => {
        const pendingLeaves = safeLeaveRequests.filter(r => r && r.status === 'En attente').length;
        const upcomingInterventions = safeInterventions.filter(i => i && !i.is_archived).length;
        const completedToday = safeInterventions.filter(i => {
            if (!i || !i.date) return false;
            const today = new Date().toISOString().split('T')[0];
            return i.date === today && i.status === 'Terminée';
        }).length;
        const inProgressToday = safeInterventions.filter(i => {
            if (!i || !i.date) return false;
            const today = new Date().toISOString().split('T')[0];
            return i.date === today && i.status === 'En cours';
        }).length;

        return {
            pendingLeaves,
            upcomingInterventions,
            completedToday,
            inProgressToday
        };
    }, [safeInterventions, safeLeaveRequests]);

    return (
        <div>
            <h3>Tableau de Bord</h3>

            {/* Indicateur mobile d'optimisation */}
            {isMobile && (
                <div className="mobile-admin-notice">
                    📱 Interface optimisée pour mobile admin
                    {isAnyDataLoading && <span> • Chargement en cours...</span>}
                </div>
            )}

            {/* Statistiques principales */}
            <div className="grid-2-cols">
                <div className="card-white">
                    {isInterventionsLoading ? (
                        <div className="skeleton-item large" style={{marginBottom: '0.5rem'}}></div>
                    ) : (
                        <p style={{fontSize: '1.875rem', fontWeight: 'bold', color: '#3b82f6'}}>
                            {stats.upcomingInterventions}
                        </p>
                    )}
                    <p className="text-muted">Interventions planifiées</p>
                    {defaultLoadingState.interventions === 'loading' && (
                        <p style={{fontSize: '0.75rem', color: '#f59e0b'}}>⏳ Chargement...</p>
                    )}
                </div>

                <div className="card-white">
                    {isLeavesLoading ? (
                        <div className="skeleton-item large" style={{marginBottom: '0.5rem'}}></div>
                    ) : (
                        <p style={{fontSize: '1.875rem', fontWeight: 'bold', color: '#f59e0b'}}>
                            {stats.pendingLeaves}
                        </p>
                    )}
                    <p className="text-muted">Demandes de congés</p>
                    {defaultLoadingState.leaves === 'loading' && (
                        <p style={{fontSize: '0.75rem', color: '#f59e0b'}}>⏳ Chargement...</p>
                    )}
                </div>
            </div>

            {/* Statistiques supplémentaires pour mobile */}
            {isMobile && !isInterventionsLoading && safeInterventions.length > 0 && (
                <div className="grid-2-cols" style={{marginTop: '1rem'}}>
                    <div className="card-white">
                        <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e'}}>
                            {stats.completedToday}
                        </p>
                        <p className="text-muted" style={{fontSize: '0.875rem'}}>Terminées aujourd'hui</p>
                    </div>

                    <div className="card-white">
                        <p style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b'}}>
                            {stats.inProgressToday}
                        </p>
                        <p className="text-muted" style={{fontSize: '0.875rem'}}>En cours aujourd'hui</p>
                    </div>
                </div>
            )}

            {/* Résumé rapide mobile */}
            {isMobile && !isInterventionsLoading && safeInterventions.length > 0 && (
                <div className="card-white" style={{marginTop: '1rem'}}>
                    <h4 style={{marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        📊 Aperçu rapide
                        {isAnyDataLoading && <span style={{fontSize: '0.75rem', color: '#f59e0b'}}>⏳</span>}
                    </h4>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>Total interventions:</span>
                            <strong>{safeInterventions.length}</strong>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>En cours:</span>
                            <strong style={{color: '#f59e0b'}}>
                                {safeInterventions.filter(i => i && i.status === 'En cours').length}
                            </strong>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>Terminées:</span>
                            <strong style={{color: '#22c55e'}}>
                                {safeInterventions.filter(i => i && i.status === 'Terminée').length}
                            </strong>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>À venir:</span>
                            <strong style={{color: '#3b82f6'}}>
                                {safeInterventions.filter(i => i && (!i.status || i.status === 'À venir')).length}
                            </strong>
                        </div>
                    </div>
                </div>
            )}

            {/* État de chargement des données */}
            {isAnyDataLoading && safeInterventions.length === 0 && safeLeaveRequests.length === 0 && (
                <div className="card-white" style={{textAlign: 'center', padding: '2rem', marginTop: '1rem'}}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
                        <div className="loading-spinner"></div>
                        <div>
                            <p style={{fontSize: '1.125rem', marginBottom: '0.5rem'}}>📊 Chargement du tableau de bord</p>
                            <p className="text-muted">
                                {isMobile ? 'Optimisation mobile en cours...' : 'Récupération des données...'}
                            </p>
                        </div>

                        {/* Indicateurs de progression mobile */}
                        {isMobile && (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'}}>
                                    {defaultLoadingState.interventions === 'loaded' ? '✅' :
                                     defaultLoadingState.interventions === 'loading' ? '⏳' : '⭕'}
                                    <span>Interventions</span>
                                </div>
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'}}>
                                    {defaultLoadingState.users === 'loaded' ? '✅' :
                                     defaultLoadingState.users === 'loading' ? '⏳' : '⭕'}
                                    <span>Utilisateurs</span>
                                </div>
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem'}}>
                                    {defaultLoadingState.leaves === 'loaded' ? '✅' :
                                     defaultLoadingState.leaves === 'loading' ? '⏳' : '⭕'}
                                    <span>Congés</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Message de bienvenue si aucune donnée après chargement */}
            {!defaultIsLoading && !isAnyDataLoading && safeInterventions.length === 0 && safeLeaveRequests.length === 0 && (
                <div className="card-white" style={{textAlign: 'center', padding: '2rem', marginTop: '1rem'}}>
                    <p style={{fontSize: '1.125rem', marginBottom: '0.5rem'}}>🎯 Tableau de bord prêt</p>
                    <p className="text-muted">
                        Aucune donnée disponible pour le moment. Les informations apparaîtront ici dès qu'elles seront disponibles.
                    </p>
                    {isMobile && (
                        <p className="text-muted" style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>
                            💡 Interface optimisée pour mobile
                        </p>
                    )}
                </div>
            )}

            {/* Message d'erreur si problème de chargement */}
            {(defaultLoadingState.interventions === 'error' || defaultLoadingState.leaves === 'error') && (
                <div className="card-white" style={{
                    textAlign: 'center',
                    padding: '2rem',
                    marginTop: '1rem',
                    border: '1px solid #fee2e2',
                    backgroundColor: '#fef2f2'
                }}>
                    <p style={{fontSize: '1.125rem', marginBottom: '0.5rem', color: '#dc2626'}}>
                        ⚠️ Problème de chargement
                    </p>
                    <p className="text-muted">
                        Certaines données n'ont pas pu être chargées. Veuillez actualiser la page ou réessayer plus tard.
                    </p>
                </div>
            )}
        </div>
    );
}