// src/components/planning/TeamGroupedView.jsx
// Vue des interventions groupées par équipe

import React, { useMemo, useState } from 'react';
import { UsersIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, AlertTriangleIcon } from '../SharedUI';
import './TeamGroupedView.css';

/**
 * Génère un identifiant d'équipe basé sur les assignés
 */
const getTeamKey = (intervention) => {
  const assignments = intervention.intervention_assignments || [];
  if (assignments.length === 0) return 'unassigned';

  // Trier les IDs pour avoir une clé cohérente
  return assignments
    .map(a => a.user_id)
    .sort()
    .join('-');
};

/**
 * Génère le nom de l'équipe
 */
const getTeamName = (intervention, usersMap) => {
  const assignments = intervention.intervention_assignments || [];
  if (assignments.length === 0) return 'Non assigné';

  return assignments
    .map(a => {
      const name = a.profiles?.full_name || usersMap[a.user_id]?.full_name;
      return name || 'Inconnu';
    })
    .join(' + ');
};

/**
 * Couleurs pour les équipes
 */
const TEAM_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  { bg: '#fae8ff', border: '#d946ef', text: '#86198f' },
  { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' },
  { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
];

const getTeamColor = (index) => {
  return TEAM_COLORS[index % TEAM_COLORS.length];
};

/**
 * Composant pour une carte d'intervention dans le groupe
 */
const TeamInterventionCard = ({ intervention, onClick }) => {
  const status = intervention.status || 'À venir';
  const isCompleted = status === 'Terminée';
  const isUrgent = intervention.report?.needs?.some(n => n.urgent);

  return (
    <div
      className={`team-intervention-card ${isCompleted ? 'completed' : ''}`}
      onClick={() => onClick?.(intervention)}
    >
      <div className="card-left">
        <div className="card-date-time">
          <span className="card-date">
            {new Date(intervention.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short'
            })}
          </span>
          <span className="card-time">{intervention.time || '08:00'}</span>
        </div>
      </div>

      <div className="card-center">
        <h4 className="card-client">{intervention.client}</h4>
        <p className="card-service">{intervention.service}</p>
        {intervention.address && (
          <p className="card-address">📍 {intervention.address}</p>
        )}
      </div>

      <div className="card-right">
        {isUrgent && (
          <span className="badge badge-urgent">
            <AlertTriangleIcon />
            Urgent
          </span>
        )}
        <span className={`badge badge-status badge-${status.toLowerCase().replace(' ', '-')}`}>
          {status}
        </span>
      </div>
    </div>
  );
};

/**
 * Composant pour un groupe d'équipe
 */
const TeamGroup = ({ team, interventions, onInterventionClick, color, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Stats pour l'équipe
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: interventions.length,
      today: interventions.filter(i => i.date === today).length,
      completed: interventions.filter(i => i.status === 'Terminée').length,
      urgent: interventions.filter(i => i.report?.needs?.some(n => n.urgent)).length,
      estimatedHours: interventions.length * 2 // 2h par intervention en moyenne
    };
  }, [interventions]);

  // Trier par date puis heure
  const sortedInterventions = useMemo(() => {
    return [...interventions].sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [interventions]);

  return (
    <div
      className="team-group"
      style={{
        '--team-bg': color.bg,
        '--team-border': color.border,
        '--team-text': color.text
      }}
    >
      <div
        className="team-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="team-info">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <UsersIcon className="team-icon" />
          <h3 className="team-name">{team}</h3>
          <span className="team-count">{stats.total} intervention{stats.total > 1 ? 's' : ''}</span>
        </div>

        <div className="team-stats">
          {stats.today > 0 && (
            <span className="stat stat-today">
              📅 {stats.today} aujourd'hui
            </span>
          )}
          {stats.urgent > 0 && (
            <span className="stat stat-urgent">
              <AlertTriangleIcon />
              {stats.urgent}
            </span>
          )}
          <span className="stat stat-hours">
            <ClockIcon />
            ~{stats.estimatedHours}h
          </span>
          <span className="stat stat-progress">
            {stats.completed}/{stats.total} terminées
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="team-interventions">
          {sortedInterventions.map(intervention => (
            <TeamInterventionCard
              key={intervention.id}
              intervention={intervention}
              onClick={onInterventionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * TeamGroupedView Component
 */
const TeamGroupedView = ({
  interventions = [],
  users = [],
  onInterventionClick
}) => {
  // Créer une map des utilisateurs
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  // Grouper les interventions par équipe
  const groupedByTeam = useMemo(() => {
    const groups = {};

    interventions.forEach(intervention => {
      const teamKey = getTeamKey(intervention);
      if (!groups[teamKey]) {
        groups[teamKey] = {
          key: teamKey,
          name: getTeamName(intervention, usersMap),
          interventions: []
        };
      }
      groups[teamKey].interventions.push(intervention);
    });

    // Trier par nombre d'interventions (décroissant), "Non assigné" en dernier
    return Object.values(groups).sort((a, b) => {
      if (a.key === 'unassigned') return 1;
      if (b.key === 'unassigned') return -1;
      return b.interventions.length - a.interventions.length;
    });
  }, [interventions, usersMap]);

  // Stats globales
  const globalStats = useMemo(() => {
    return {
      totalTeams: groupedByTeam.filter(g => g.key !== 'unassigned').length,
      totalInterventions: interventions.length,
      unassigned: groupedByTeam.find(g => g.key === 'unassigned')?.interventions.length || 0
    };
  }, [groupedByTeam, interventions.length]);

  if (interventions.length === 0) {
    return (
      <div className="team-grouped-empty">
        <UsersIcon className="empty-icon" />
        <p>Aucune intervention à afficher</p>
      </div>
    );
  }

  return (
    <div className="team-grouped-view">
      {/* Stats globales */}
      <div className="global-stats">
        <div className="global-stat">
          <span className="stat-value">{globalStats.totalTeams}</span>
          <span className="stat-label">Équipe{globalStats.totalTeams > 1 ? 's' : ''}</span>
        </div>
        <div className="global-stat">
          <span className="stat-value">{globalStats.totalInterventions}</span>
          <span className="stat-label">Intervention{globalStats.totalInterventions > 1 ? 's' : ''}</span>
        </div>
        {globalStats.unassigned > 0 && (
          <div className="global-stat stat-warning">
            <span className="stat-value">{globalStats.unassigned}</span>
            <span className="stat-label">Non assignée{globalStats.unassigned > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Groupes d'équipes */}
      <div className="team-groups">
        {groupedByTeam.map((group, index) => (
          <TeamGroup
            key={group.key}
            team={group.name}
            interventions={group.interventions}
            onInterventionClick={onInterventionClick}
            color={group.key === 'unassigned' ? { bg: '#f1f5f9', border: '#94a3b8', text: '#64748b' } : getTeamColor(index)}
            defaultExpanded={index < 3}
          />
        ))}
      </div>
    </div>
  );
};

export default TeamGroupedView;
