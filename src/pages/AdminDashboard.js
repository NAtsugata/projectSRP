// src/pages/AdminDashboard.js - Version refactorisée
// Dashboard administrateur avec statistiques, activités et actions rapides

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard, RecentActivity, QuickActions, AlertCard } from '../components/dashboard';
import {
  BriefcaseIcon,
  CalendarIcon,
  AlertTriangleIcon,
  CheckIcon,
  UsersIcon,
  PlusIcon
} from '../components/SharedUI';
import logger from '../utils/logger';
import './AdminDashboard.css';

export default function AdminDashboard({ interventions = [], leaveRequests = [] }) {
  const navigate = useNavigate();

  // Calcul des statistiques
  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Interventions
    const activeInterventions = interventions.filter(i => !i.is_archived);
    const todayInterventions = activeInterventions.filter(i => i.date === today);
    const urgentInterventions = activeInterventions.filter(i =>
      i.additional_needs?.some(need => need.isUrgent)
    );

    // Demandes de congés
    const pendingLeaves = leaveRequests.filter(r => r.status === 'En attente');
    const approvedLeaves = leaveRequests.filter(r => r.status === 'Approuvée');

    // Interventions terminées cette semaine
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const completedThisWeek = interventions.filter(i => {
      if (!i.is_archived || !i.archived_at) return false;
      const archivedDate = new Date(i.archived_at);
      return archivedDate >= startOfWeek;
    }).length;

    logger.log('AdminDashboard: Statistiques calculées', {
      activeInterventions: activeInterventions.length,
      todayInterventions: todayInterventions.length,
      urgentInterventions: urgentInterventions.length,
      pendingLeaves: pendingLeaves.length
    });

    return {
      activeInterventions: activeInterventions.length,
      todayInterventions: todayInterventions.length,
      urgentInterventions: urgentInterventions.length,
      pendingLeaves: pendingLeaves.length,
      approvedLeaves: approvedLeaves.length,
      completedThisWeek
    };
  }, [interventions, leaveRequests]);

  // Activités récentes
  const recentActivities = useMemo(() => {
    const activities = [];

    // Dernières interventions créées
    const recentInterventions = [...interventions]
      .filter(i => !i.is_archived)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3);

    recentInterventions.forEach(i => {
      activities.push({
        icon: <BriefcaseIcon />,
        title: `Intervention créée: ${i.client}`,
        description: `${i.service} - ${i.address}`,
        time: formatRelativeTime(i.created_at),
        variant: 'primary'
      });
    });

    // Dernières demandes de congés
    const recentLeaves = [...leaveRequests]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 2);

    recentLeaves.forEach(l => {
      activities.push({
        icon: <CalendarIcon />,
        title: `Demande de congé: ${l.user_name}`,
        description: `Du ${formatDate(l.start_date)} au ${formatDate(l.end_date)}`,
        time: formatRelativeTime(l.created_at),
        variant: l.status === 'En attente' ? 'warning' : 'success'
      });
    });

    return activities.sort((a, b) => {
      // Trier par time (plus récent d'abord)
      return 0; // Déjà trié
    }).slice(0, 5);
  }, [interventions, leaveRequests]);

  // Actions rapides
  const quickActions = [
    {
      label: 'Nouvelle Intervention',
      icon: <PlusIcon />,
      variant: 'primary',
      onClick: () => navigate('/planning?new=true')
    },
    {
      label: 'Voir Planning',
      icon: <BriefcaseIcon />,
      variant: 'secondary',
      onClick: () => navigate('/planning')
    },
    {
      label: 'Gérer Congés',
      icon: <CalendarIcon />,
      variant: 'secondary',
      onClick: () => navigate('/leaves')
    },
    {
      label: 'Gérer Utilisateurs',
      icon: <UsersIcon />,
      variant: 'secondary',
      onClick: () => navigate('/users')
    }
  ];

  // Alertes
  const alerts = useMemo(() => {
    const alertList = [];

    // Alerte interventions urgentes
    if (stats.urgentInterventions > 0) {
      alertList.push({
        title: `${stats.urgentInterventions} intervention${stats.urgentInterventions > 1 ? 's' : ''} urgente${stats.urgentInterventions > 1 ? 's' : ''}`,
        message: 'Des interventions nécessitent une attention immédiate.',
        variant: 'danger',
        icon: <AlertTriangleIcon />,
        action: (
          <button
            className="alert-action-link"
            onClick={() => navigate('/planning')}
          >
            Voir les interventions →
          </button>
        )
      });
    }

    // Alerte demandes de congés en attente
    if (stats.pendingLeaves > 0) {
      alertList.push({
        title: `${stats.pendingLeaves} demande${stats.pendingLeaves > 1 ? 's' : ''} de congé en attente`,
        message: 'Des employés attendent une réponse à leur demande.',
        variant: 'warning',
        action: (
          <button
            className="alert-action-link"
            onClick={() => navigate('/leaves')}
          >
            Traiter les demandes →
          </button>
        )
      });
    }

    return alertList;
  }, [stats, navigate]);

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Tableau de Bord</h2>
        <p className="dashboard-description">
          Vue d'ensemble de l'activité de votre entreprise
        </p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="dashboard-alerts">
          {alerts.map((alert, index) => (
            <AlertCard key={index} {...alert} />
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="dashboard-stats">
        <StatCard
          value={stats.activeInterventions}
          label="Interventions planifiées"
          icon={<BriefcaseIcon />}
          variant="primary"
          onClick={() => navigate('/planning')}
        />

        <StatCard
          value={stats.todayInterventions}
          label="Interventions aujourd'hui"
          icon={<CalendarIcon />}
          variant="info"
          onClick={() => navigate('/planning')}
        />

        <StatCard
          value={stats.urgentInterventions}
          label="Interventions urgentes"
          icon={<AlertTriangleIcon />}
          variant="danger"
          onClick={() => navigate('/planning')}
        />

        <StatCard
          value={stats.pendingLeaves}
          label="Demandes de congés"
          icon={<CalendarIcon />}
          variant="warning"
          onClick={() => navigate('/leaves')}
        />

        <StatCard
          value={stats.completedThisWeek}
          label="Terminées cette semaine"
          icon={<CheckIcon />}
          variant="success"
          onClick={() => navigate('/archives')}
        />

        <StatCard
          value={stats.approvedLeaves}
          label="Congés approuvés"
          icon={<CalendarIcon />}
          variant="success"
          onClick={() => navigate('/leaves')}
        />
      </div>

      {/* Content Grid */}
      <div className="dashboard-content">
        {/* Recent Activity */}
        <div className="dashboard-section">
          <RecentActivity
            activities={recentActivities}
            title="Activité récente"
            maxItems={5}
          />
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section">
          <QuickActions
            actions={quickActions}
            title="Actions rapides"
          />
        </div>
      </div>
    </div>
  );
}

// Helper: Format relative time
function formatRelativeTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return formatDate(dateString);
}

// Helper: Format date
function formatDate(dateString) {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  } catch (e) {
    return dateString;
  }
}
