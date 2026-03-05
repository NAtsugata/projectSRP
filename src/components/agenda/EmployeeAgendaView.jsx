// src/components/agenda/EmployeeAgendaView.jsx
// Vue agenda simplifiée et intuitive pour les employés

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  CheckCircleIcon,
  NavigationIcon,
  PlayIcon
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
  const [viewMode, setViewMode] = useState('day'); // 'day' ou 'week' - par défaut 'day' pour plus de clarté
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mettre à jour l'heure courante toutes les minutes
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Trouver la prochaine intervention (celle à faire maintenant ou bientôt)
  const nextIntervention = useMemo(() => {
    const now = currentTime;
    const todayStr = toLocalDateStr(now);
    const currentTimeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Interventions d'aujourd'hui non terminées, triées par heure
    const todayPending = interventions
      .filter(itv => {
        const itvDate = itv.scheduled_dates?.includes(todayStr) ? todayStr : itv.date;
        return itvDate === todayStr && itv.status !== 'completed' && itv.status !== 'cancelled';
      })
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });

    // Trouver la prochaine intervention (heure >= maintenant, ou en cours)
    const inProgress = todayPending.find(itv => itv.status === 'in_progress');
    if (inProgress) return inProgress;

    const upcoming = todayPending.find(itv => itv.time && itv.time >= currentTimeStr);
    if (upcoming) return upcoming;

    // Sinon, la première intervention en attente
    return todayPending[0] || null;
  }, [interventions, currentTime]);

  // Vérifier si une intervention est en retard
  const isLate = useCallback((intervention) => {
    if (!intervention.time || intervention.status === 'completed' || intervention.status === 'in_progress') {
      return false;
    }
    const now = currentTime;
    const todayStr = toLocalDateStr(now);
    const currentTimeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const itvDate = intervention.scheduled_dates?.includes(todayStr) ? todayStr : intervention.date;
    return itvDate === todayStr && intervention.time < currentTimeStr;
  }, [currentTime]);

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
        <div className="header-time">
          {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* SECTION PROCHAINE INTERVENTION - Mise en avant */}
      {nextIntervention && (
        <div className="next-intervention-section">
          <div className="next-intervention-label">
            <PlayIcon className="next-icon" />
            {nextIntervention.status === 'in_progress' ? 'En cours maintenant' : 'Prochaine intervention'}
          </div>
          <NextInterventionCard
            intervention={nextIntervention}
            onClick={() => handleInterventionClick(nextIntervention)}
            onCall={handleCall}
            isLate={isLate(nextIntervention)}
          />
        </div>
      )}

      {/* Stats du jour - Plus simples et claires */}
      <div className="day-summary">
        <div className="summary-item">
          <span className="summary-number">{todayInterventions.filter(i => i.status !== 'completed').length}</span>
          <span className="summary-text">à faire aujourd'hui</span>
        </div>
        <div className="summary-separator">|</div>
        <div className="summary-item">
          <span className="summary-number">{todayInterventions.filter(i => i.status === 'completed').length}</span>
          <span className="summary-text">terminée{todayInterventions.filter(i => i.status === 'completed').length > 1 ? 's' : ''}</span>
        </div>
        {todayInterventions.some(i => i.priority === 'urgent' || i.is_urgent) && (
          <>
            <div className="summary-separator">|</div>
            <div className="summary-item summary-urgent">
              <span className="summary-number">{todayInterventions.filter(i => i.priority === 'urgent' || i.is_urgent).length}</span>
              <span className="summary-text">urgente{todayInterventions.filter(i => i.priority === 'urgent' || i.is_urgent).length > 1 ? 's' : ''}</span>
            </div>
          </>
        )}
      </div>

      {/* Bouton Aujourd'hui */}
      <button className="today-btn-large" onClick={handleToday}>
        <CalendarIcon className="today-icon" />
        Voir aujourd'hui
      </button>

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
                      isLate={isLate(intervention)}
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
 * Carte PROCHAINE INTERVENTION - Grande et mise en avant
 */
const NextInterventionCard = ({ intervention, onClick, onCall, isLate }) => {
  const isUrgent = intervention.priority === 'urgent' || intervention.is_urgent;
  const isInProgress = intervention.status === 'in_progress';
  const clientName = intervention.clients?.name || intervention.client_name || 'Client';
  const clientPhone = intervention.clients?.phone || intervention.client_phone;
  const address = intervention.clients?.address || intervention.address;

  // Ouvrir dans Google Maps
  const openMaps = (e) => {
    e.stopPropagation();
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  return (
    <div
      className={`next-intervention-card ${isUrgent ? 'is-urgent' : ''} ${isInProgress ? 'is-active' : ''} ${isLate ? 'is-late' : ''}`}
      onClick={onClick}
    >
      {/* Indicateur de statut bien visible */}
      <div className="next-status">
        {isLate && <span className="status-late">EN RETARD</span>}
        {isInProgress && <span className="status-active">EN COURS</span>}
        {isUrgent && !isLate && !isInProgress && <span className="status-urgent">URGENT</span>}
      </div>

      {/* Heure - Grande et visible */}
      <div className="next-time">
        <ClockIcon className="next-time-icon" />
        <span className="next-time-value">{intervention.time || 'Pas d\'heure'}</span>
      </div>

      {/* Titre clair */}
      <h3 className="next-title">
        {intervention.title || intervention.description || 'Intervention'}
      </h3>

      {/* Client */}
      <div className="next-client">
        <UserIcon className="next-client-icon" />
        <span>{clientName}</span>
      </div>

      {/* Adresse avec bouton Maps */}
      {address && (
        <div className="next-address">
          <MapPinIcon className="next-address-icon" />
          <span className="next-address-text">{address}</span>
          <button className="maps-btn" onClick={openMaps} title="Ouvrir dans Maps">
            <NavigationIcon />
            GPS
          </button>
        </div>
      )}

      {/* Actions principales - Grandes et claires */}
      <div className="next-actions">
        {clientPhone && (
          <button className="next-action-btn call" onClick={(e) => onCall(clientPhone, e)}>
            <PhoneIcon />
            Appeler le client
          </button>
        )}
        <button className="next-action-btn details" onClick={onClick}>
          Voir les détails
        </button>
      </div>
    </div>
  );
};

/**
 * Carte d'intervention simplifiée
 */
const InterventionCard = ({
  intervention,
  onClick,
  onCall,
  getStatusColor,
  getStatusLabel,
  compact = false,
  isLate = false
}) => {
  const isUrgent = intervention.priority === 'urgent' || intervention.is_urgent;
  const isCompleted = intervention.status === 'completed';
  const clientName = intervention.clients?.name || intervention.client_name || 'Client';
  const clientPhone = intervention.clients?.phone || intervention.client_phone;
  const address = intervention.clients?.address || intervention.address;

  return (
    <div
      className={`intervention-card ${compact ? 'compact' : ''} ${isUrgent ? 'is-urgent' : ''} ${isCompleted ? 'is-completed' : ''} ${isLate ? 'is-late' : ''}`}
      onClick={onClick}
    >
      {/* Timeline avec heure et statut */}
      <div className="card-timeline">
        <div className={`timeline-dot ${getStatusColor(intervention.status)}`}></div>
        <div className="timeline-content">
          <span className="timeline-time">{intervention.time || '--:--'}</span>
          <span className={`timeline-status ${getStatusColor(intervention.status)}`}>
            {getStatusLabel(intervention.status)}
          </span>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="card-main">
        <h4 className="card-title">
          {isUrgent && <AlertTriangleIcon className="urgent-badge" />}
          {intervention.title || intervention.description || 'Intervention'}
        </h4>
        <div className="card-client-line">
          <UserIcon className="client-icon" />
          <span>{clientName}</span>
        </div>
        {address && !compact && (
          <div className="card-address-line">
            <MapPinIcon className="address-icon" />
            <span>{address}</span>
          </div>
        )}
      </div>

      {/* Action rapide */}
      <div className="card-quick-action">
        {clientPhone && !isCompleted ? (
          <button
            className="quick-call-btn"
            onClick={(e) => onCall(clientPhone, e)}
            title="Appeler"
          >
            <PhoneIcon />
          </button>
        ) : isCompleted ? (
          <CheckCircleIcon className="completed-check" />
        ) : (
          <ChevronRightIcon className="card-chevron" />
        )}
      </div>
    </div>
  );
};

export default EmployeeAgendaView;
