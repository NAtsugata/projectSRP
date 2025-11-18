// src/utils/notificationHelper.js
// Système de notifications pour l'agenda

import { checkEmployeeOverload } from './agendaHelpers';
import { isEmployeeAbsent } from '../components/agenda/AbsenceManager';

/**
 * Check for upcoming interventions (within next 2 hours)
 */
export const checkUpcomingInterventions = (interventions, currentUserId) => {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const upcomingForUser = interventions.filter(itv => {
    if (!itv.assigned_to || !itv.assigned_to.includes(currentUserId)) return false;
    if (!itv.date || !itv.time) return false;

    const itvDateTime = new Date(`${itv.date}T${itv.time}`);
    return itvDateTime >= now && itvDateTime <= twoHoursLater;
  });

  return upcomingForUser.map(itv => ({
    type: 'upcoming',
    priority: 'high',
    title: 'Intervention à venir',
    message: `${itv.client} - ${itv.service || ''} à ${itv.time}`,
    intervention: itv,
    timestamp: new Date().toISOString()
  }));
};

/**
 * Check for overloaded employees
 */
export const checkOverloadedEmployees = (interventions, employees, date) => {
  const alerts = [];

  employees.forEach(emp => {
    const overloadCheck = checkEmployeeOverload(emp.id, date, interventions, 8);

    if (overloadCheck.overloaded) {
      alerts.push({
        type: 'overload',
        priority: 'warning',
        title: 'Surcharge détectée',
        message: `${emp.full_name || emp.name} : ${overloadCheck.hours.toFixed(1)}h de travail`,
        employee: emp,
        timestamp: new Date().toISOString()
      });
    }
  });

  return alerts;
};

/**
 * Check for interventions assigned to absent employees
 */
export const checkAbsentAssignments = (interventions, employees) => {
  const alerts = [];

  interventions.forEach(itv => {
    if (!itv.assigned_to || !itv.date) return;

    itv.assigned_to.forEach(empId => {
      if (isEmployeeAbsent(empId, itv.date)) {
        const employee = employees.find(e => e.id === empId);
        alerts.push({
          type: 'absent',
          priority: 'critical',
          title: 'Employé absent',
          message: `${employee?.full_name || 'Employé'} est absent le ${itv.date}`,
          intervention: itv,
          employee,
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  return alerts;
};

/**
 * Check for unassigned urgent interventions
 */
export const checkUnassignedUrgent = (interventions) => {
  const alerts = [];

  interventions.forEach(itv => {
    const isUrgent = itv.report?.needs?.some(n => n.urgent);
    const isUnassigned = !itv.assigned_to || itv.assigned_to.length === 0;

    if (isUrgent && isUnassigned) {
      alerts.push({
        type: 'unassigned_urgent',
        priority: 'critical',
        title: 'Intervention urgente non assignée',
        message: `${itv.client} - ${itv.service || ''} le ${itv.date}`,
        intervention: itv,
        timestamp: new Date().toISOString()
      });
    }
  });

  return alerts;
};

/**
 * Get all notifications for the agenda
 */
export const getAgendaNotifications = (interventions, employees, currentUserId, dateRange) => {
  const notifications = [];

  // Upcoming interventions for current user
  if (currentUserId) {
    notifications.push(...checkUpcomingInterventions(interventions, currentUserId));
  }

  // Overloaded employees
  if (dateRange) {
    const today = new Date().toISOString().split('T')[0];
    notifications.push(...checkOverloadedEmployees(interventions, employees, today));
  }

  // Absent employee assignments
  notifications.push(...checkAbsentAssignments(interventions, employees));

  // Unassigned urgent interventions
  notifications.push(...checkUnassignedUrgent(interventions));

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, warning: 2, info: 3 };
  notifications.sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return notifications;
};

/**
 * Simple notification toast (can be replaced with a proper toast library)
 */
export const showNotificationToast = (notification) => {
  // This is a simple implementation using alert
  // In production, use a proper toast library like react-toastify
  const emoji = {
    critical: '🚨',
    high: '⚠️',
    warning: '⚡',
    info: 'ℹ️'
  };

  const message = `${emoji[notification.priority]} ${notification.title}\n${notification.message}`;

  // For now, just log to console
  console.log(message);

  // TODO: Replace with proper toast notification
  // toast[notification.priority](message);
};
