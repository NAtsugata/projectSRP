// src/components/agenda/EmployeeAgendaView.jsx
// Vue agenda simplifiée et intuitive pour les employés

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from '../SharedUI';
import { toLocalDateStr } from '../../utils/agendaHelpers';
import './EmployeeAgendaView.css';

/**
 * Vue agenda simplifiée pour les employés
 * Affiche leurs interventions de manière claire et intuitive
 */
const EmployeeAgendaView = ({
  interventions = [],
  loading = false,
  error = null,
  userName = ''
}) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'day' ou 'week'

  // Formater une date en français
  const formatDate = useCallback((date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, []);

  // Formater une date courte
  const formatShortDate = useCallback((date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric'
    });
  }, []);

  // Obtenir les dates de la semaine
  const weekDates = useMemo(() => {
    const dates = [];
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Commencer lundi
    start.setDate(start.getDate() + diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentDate]);

  // Filtrer les interventions par date
  const getInterventionsForDate = useCallback((date) => {
    const dateStr = toLocalDateStr(date);
    return interventions.filter(itv => {
      // Vérifier les dates programmées (multi-jour)
      if (itv.scheduled_dates && Array.isArray(itv.scheduled_dates)) {
        return itv.scheduled_dates.includes(dateStr);
      }
      // Sinon vérifier la date principale
      return itv.date === dateStr;
    });
  }, [interventions]);

  // Interventions du jour sélectionné
  const todayInterventions = useMemo(() => {
    return getInterventionsForDate(currentDate);
  }, [currentDate, getInterventionsForDate]);

  // Compter les interventions de la semaine
  const weekStats = useMemo(() => {
    let total = 0;
    let urgent = 0;
    let completed = 0;

    weekDates.forEach(date => {
      const dayInterventions = getInterventionsForDate(date);
      total += dayInterventions.length;
      urgent += dayInterventions.filter(itv => itv.priority === 'urgent' || itv.is_urgent).length;
      completed += dayInterventions.filter(itv => itv.status === 'completed').length;
    });

    return { total, urgent, completed, remaining: total - completed };
  }, [weekDates, getInterventionsForDate]);

  // Navigation
  const handlePrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDateSelect = useCallback((date) => {
    setCurrentDate(date);
    setViewMode('day');
  }, []);

  const handleInterventionClick = useCallback((intervention) => {
    navigate(`/planning/${intervention.id}`);
  }, [navigate]);

  // Appeler le client
  const handleCall = useCallback((phone, e) => {
    e.stopPropagation();
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }, []);

  // Vérifier si c'est aujourd'hui
  const isToday = useCallback((date) => {
    const today = new Date();
    return toLocalDateStr(date) === toLocalDateStr(today);
  }, []);

  // Vérifier si c'est le jour sélectionné
  const isSelected = useCallback((date) => {
    return toLocalDateStr(date) === toLocalDateStr(currentDate);
  }, [currentDate]);

  // Obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'in_progress': return 'status-progress';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  // Obtenir le label du statut
  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Terminée';
      case 'in_progress': return 'En cours';
      case 'cancelled': return 'Annulée';
      default: return 'A faire';
    }
  };

  if (loading) {
    return (
      <div className="employee-agenda">
        <div className="employee-agenda-loading">
          <div className="loading-spinner"></div>
          <p>Chargement de votre agenda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-agenda">
        <div className="employee-agenda-error">
          <AlertTriangleIcon className="error-icon" />
          <h3>Erreur de chargement</h3>
          <p>{error.message || "Impossible de charger l'agenda"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-agenda">
      {/* Header avec salutation */}
      <header className="employee-agenda-header">
        <div className="header-greeting">
          <h1>Mon Agenda</h1>
          {userName && <p className="greeting-text">Bonjour {userName}</p>}
        </div>
        <button className="today-btn" onClick={handleToday}>
          Aujourd'hui
        </button>
      </header>

      {/* Stats rapides de la semaine */}
      <div className="week-stats">
        <div className="stat-item">
          <span className="stat-value">{weekStats.remaining}</span>
          <span className="stat-label">A faire</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{weekStats.completed}</span>
          <span className="stat-label">Terminées</span>
        </div>
        {weekStats.urgent > 0 && (
          <div className="stat-item stat-urgent">
            <span className="stat-value">{weekStats.urgent}</span>
            <span className="stat-label">Urgentes</span>
          </div>
        )}
      </div>

      {/* Navigation et sélecteur de vue */}
      <div className="date-navigation">
        <button className="nav-btn" onClick={handlePrevious}>
          <ChevronLeftIcon />
        </button>

        <div className="date-display">
          {viewMode === 'day' ? (
            <span className="current-date">{formatDate(currentDate)}</span>
          ) : (
            <span className="current-date">
              Semaine du {formatShortDate(weekDates[0])}
            </span>
          )}
        </div>

        <button className="nav-btn" onClick={handleNext}>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Toggle vue jour/semaine */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'day' ? 'active' : ''}`}
          onClick={() => setViewMode('day')}
        >
          Jour
        </button>
        <button
          className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
          onClick={() => setViewMode('week')}
        >
          Semaine
        </button>
      </div>

      {/* Vue semaine - calendrier horizontal */}
      {viewMode === 'week' && (
        <div className="week-calendar">
          {weekDates.map((date, index) => {
            const dayInterventions = getInterventionsForDate(date);
            const hasUrgent = dayInterventions.some(itv => itv.priority === 'urgent' || itv.is_urgent);

            return (
              <button
                key={index}
                className={`day-cell ${isToday(date) ? 'is-today' : ''} ${isSelected(date) ? 'is-selected' : ''}`}
                onClick={() => handleDateSelect(date)}
              >
                <span className="day-name">
                  {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </span>
                <span className="day-number">{date.getDate()}</span>
                {dayInterventions.length > 0 && (
                  <span className={`day-count ${hasUrgent ? 'has-urgent' : ''}`}>
                    {dayInterventions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste des interventions */}
      <div className="interventions-list">
        {viewMode === 'day' ? (
          <>
            <h2 className="list-title">
              <CalendarIcon className="title-icon" />
              {isToday(currentDate) ? "Aujourd'hui" : formatDate(currentDate)}
              <span className="count-badge">{todayInterventions.length}</span>
            </h2>

            {todayInterventions.length === 0 ? (
              <div className="no-interventions">
                <CheckCircleIcon className="empty-icon" />
                <p>Aucune intervention prévue</p>
                <span className="empty-hint">Profitez de cette journée libre !</span>
              </div>
            ) : (
              <div className="interventions-cards">
                {todayInterventions
                  .sort((a, b) => {
                    // Trier par heure
                    if (a.time && b.time) return a.time.localeCompare(b.time);
                    if (a.time) return -1;
                    if (b.time) return 1;
                    return 0;
                  })
                  .map((intervention) => (
                    <InterventionCard
                      key={intervention.id}
                      intervention={intervention}
                      onClick={() => handleInterventionClick(intervention)}
                      onCall={handleCall}
                      getStatusColor={getStatusColor}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
              </div>
            )}
          </>
        ) : (
          // Vue semaine - toutes les interventions groupées
          <div className="week-interventions">
            {weekDates.map((date, index) => {
              const dayInterventions = getInterventionsForDate(date);
              if (dayInterventions.length === 0) return null;

              return (
                <div key={index} className="day-group">
                  <h3 className={`day-header ${isToday(date) ? 'is-today' : ''}`}>
                    {isToday(date) ? "Aujourd'hui" : formatShortDate(date)}
                    <span className="day-count-inline">{dayInterventions.length}</span>
                  </h3>
                  <div className="day-interventions">
                    {dayInterventions
                      .sort((a, b) => {
                        if (a.time && b.time) return a.time.localeCompare(b.time);
                        if (a.time) return -1;
                        if (b.time) return 1;
                        return 0;
                      })
                      .map((intervention) => (
                        <InterventionCard
                          key={intervention.id}
                          intervention={intervention}
                          onClick={() => handleInterventionClick(intervention)}
                          onCall={handleCall}
                          getStatusColor={getStatusColor}
                          getStatusLabel={getStatusLabel}
                          compact={true}
                        />
                      ))}
                  </div>
                </div>
              );
            })}

            {weekStats.total === 0 && (
              <div className="no-interventions">
                <CheckCircleIcon className="empty-icon" />
                <p>Aucune intervention cette semaine</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Carte d'intervention
 */
const InterventionCard = ({
  intervention,
  onClick,
  onCall,
  getStatusColor,
  getStatusLabel,
  compact = false
}) => {
  const isUrgent = intervention.priority === 'urgent' || intervention.is_urgent;
  const clientName = intervention.clients?.name || intervention.client_name || 'Client';
  const clientPhone = intervention.clients?.phone || intervention.client_phone;
  const address = intervention.clients?.address || intervention.address;

  return (
    <div
      className={`intervention-card ${compact ? 'compact' : ''} ${isUrgent ? 'is-urgent' : ''}`}
      onClick={onClick}
    >
      {/* En-tête avec heure et statut */}
      <div className="card-header">
        <div className="time-badge">
          <ClockIcon className="time-icon" />
          <span>{intervention.time || 'Heure non définie'}</span>
        </div>
        <span className={`status-badge ${getStatusColor(intervention.status)}`}>
          {getStatusLabel(intervention.status)}
        </span>
      </div>

      {/* Titre et type */}
      <div className="card-body">
        <h4 className="intervention-title">
          {isUrgent && <AlertTriangleIcon className="urgent-icon" />}
          {intervention.title || intervention.description || 'Intervention'}
        </h4>
        {intervention.type && (
          <span className="intervention-type">{intervention.type}</span>
        )}
      </div>

      {/* Informations client */}
      <div className="card-client">
        <div className="client-info">
          <UserIcon className="info-icon" />
          <span className="client-name">{clientName}</span>
        </div>

        {address && !compact && (
          <div className="client-address">
            <MapPinIcon className="info-icon" />
            <span>{address}</span>
          </div>
        )}
      </div>

      {/* Actions rapides */}
      <div className="card-actions">
        {clientPhone && (
          <button
            className="action-btn call-btn"
            onClick={(e) => onCall(clientPhone, e)}
            title={`Appeler ${clientPhone}`}
          >
            <PhoneIcon />
            <span>Appeler</span>
          </button>
        )}
        <button className="action-btn details-btn" onClick={onClick}>
          Voir détails
        </button>
      </div>
    </div>
  );
};

export default EmployeeAgendaView;
