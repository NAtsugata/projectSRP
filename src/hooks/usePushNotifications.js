// src/hooks/usePushNotifications.js
// Hook pour gérer les notifications push avec Supabase Realtime
// ✅ Amélioré avec écoute des assignations et rappels programmés

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';
import {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  registerServiceWorker,
  notifyNewIntervention,
  notifyInterventionUpdate,
  showLocalNotification,
  testNotification
} from '../services/pushNotificationService';

/**
 * Hook principal pour gérer les notifications push
 */
export const usePushNotifications = (userId) => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Vérifier le support et l'état des notifications
  useEffect(() => {
    setIsSupported(isNotificationSupported());

    if (isNotificationSupported()) {
      setPermission(Notification.permission);
      setIsEnabled(isNotificationEnabled());
    }
  }, []);

  // Demander la permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Notifications non supportées');
    }

    setIsRegistering(true);
    try {
      // 1. Demander permission
      const granted = await requestNotificationPermission();

      if (!granted) {
        setPermission('denied');
        setIsEnabled(false);
        setIsRegistering(false);
        return false;
      }

      // 2. Enregistrer le Service Worker
      await registerServiceWorker();

      // 3. Mettre à jour l'état
      setPermission('granted');
      setIsEnabled(true);

      // 4. Tester avec une notification
      await testNotification();

      setIsRegistering(false);
      return true;
    } catch (error) {
      logger.error('Erreur activation notifications:', error);
      setIsRegistering(false);
      throw error;
    }
  }, [isSupported]);

  return {
    isSupported,
    isEnabled,
    permission,
    isRegistering,
    requestPermission
  };
};

/**
 * Hook pour écouter les nouvelles interventions en temps réel
 * ✅ Écoute les assignations ET les rappels programmés
 */
export const useInterventionNotifications = (userId, enabled = true) => {
  const [lastNotification, setLastNotification] = useState(null);
  const sentRemindersRef = useRef(new Set()); // Évite les doublons de rappels

  // 📡 Écoute temps réel Supabase
  useEffect(() => {
    if (!userId || !enabled || !isNotificationEnabled()) {
      return;
    }

    let isMounted = true;

    logger.log('🔔 Écoute des interventions pour l\'utilisateur:', userId);

    // Canal pour les assignations (nouvelles interventions assignées)
    const assignmentChannel = supabase
      .channel('assignment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intervention_assignments',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          logger.log('🆕 Nouvelle assignation détectée:', payload);

          try {
            // Récupérer les détails de l'intervention
            const { data: intervention } = await supabase
              .from('interventions')
              .select('*')
              .eq('id', payload.new.intervention_id)
              .single();

            if (intervention && isMounted) {
              await notifyNewIntervention(intervention);
              setLastNotification({
                type: 'new',
                intervention,
                timestamp: new Date()
              });
            }
          } catch (error) {
            logger.error('Erreur notification nouvelle assignation:', error);
          }
        }
      )
      .subscribe((status) => {
        logger.log('📡 Statut subscription assignations:', status);
      });

    // Canal pour les modifications d'interventions
    const interventionChannel = supabase
      .channel('interventions-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interventions'
        },
        async (payload) => {
          if (!isMounted) return;

          // Vérifier si l'utilisateur est assigné à cette intervention
          const { data: assignment } = await supabase
            .from('intervention_assignments')
            .select('id')
            .eq('intervention_id', payload.new.id)
            .eq('user_id', userId)
            .single();

          if (!assignment || !isMounted) return;

          logger.log('📝 Intervention modifiée:', payload);

          try {
            const old = payload.old;
            const updated = payload.new;

            let updateType = 'update';
            if (updated.status === 'cancelled') {
              updateType = 'cancelled';
            } else if (updated.scheduled_dates !== old.scheduled_dates) {
              updateType = 'rescheduled';
            } else if (updated.priority === 'urgent' && old.priority !== 'urgent') {
              updateType = 'urgent';
            }

            await notifyInterventionUpdate(updated, updateType);
            if (isMounted) {
              setLastNotification({
                type: updateType,
                intervention: updated,
                timestamp: new Date()
              });
            }
          } catch (error) {
            logger.error('Erreur notification mise à jour intervention:', error);
          }
        }
      )
      .subscribe((status) => {
        logger.log('📡 Statut subscription interventions:', status);
      });

    // Cleanup
    return () => {
      isMounted = false;
      logger.log('🔕 Arrêt écoute interventions');
      assignmentChannel.unsubscribe();
      interventionChannel.unsubscribe();
    };
  }, [userId, enabled]);

  // ⏰ Rappels programmés améliorés (basés sur l'heure exacte)
  useEffect(() => {
    if (!userId || !enabled || !isNotificationEnabled()) {
      return;
    }

    /**
     * Combine une date et une heure en un objet Date
     * @param {string} dateStr - Date au format YYYY-MM-DD
     * @param {string} timeStr - Heure au format HH:MM ou HH:MM:SS
     * @returns {Date}
     */
    const combineDateTime = (dateStr, timeStr) => {
      const time = timeStr || '08:00';
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date(dateStr);
      date.setHours(hours, minutes, 0, 0);
      return date;
    };

    /**
     * Formate l'heure pour l'affichage
     */
    const formatTimeDisplay = (timeStr) => {
      if (!timeStr) return '08:00';
      const parts = timeStr.split(':');
      return `${parts[0]}:${parts[1]}`;
    };

    const checkUpcomingInterventions = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Récupérer les interventions assignées à l'utilisateur
        const { data: assignments } = await supabase
          .from('intervention_assignments')
          .select('intervention_id')
          .eq('user_id', userId);

        if (!assignments || assignments.length === 0) return;

        const interventionIds = assignments.map(a => a.intervention_id);

        // Récupérer les interventions à venir (aujourd'hui et demain)
        const { data: interventions } = await supabase
          .from('interventions')
          .select('*')
          .in('id', interventionIds)
          .neq('status', 'Terminée')
          .neq('status', 'cancelled')
          .eq('is_archived', false);

        if (!interventions) return;

        for (const intervention of interventions) {
          // Utiliser scheduled_dates ou la date principale
          const scheduledDates = intervention.scheduled_dates?.length > 0
            ? intervention.scheduled_dates
            : (intervention.date ? [intervention.date] : []);

          for (const dateStr of scheduledDates) {
            // Combiner date + heure pour obtenir le datetime exact
            const scheduledDateTime = combineDateTime(dateStr, intervention.time);
            const timeUntil = scheduledDateTime.getTime() - now.getTime();
            const minutesUntil = timeUntil / (1000 * 60);

            // === RAPPEL 1H AVANT (entre 55 et 65 minutes avant) ===
            const reminder1hKey = `${intervention.id}_${dateStr}_1h`;
            if (
              !sentRemindersRef.current.has(reminder1hKey) &&
              minutesUntil > 55 &&
              minutesUntil <= 65
            ) {
              logger.log('⏰ Rappel 1h avant pour:', intervention.client, 'à', formatTimeDisplay(intervention.time));

              await showLocalNotification('⏰ Intervention dans 1 heure', {
                body: `${formatTimeDisplay(intervention.time)} - ${intervention.client}\n${intervention.address || 'Adresse non spécifiée'}`,
                tag: `reminder-1h-${intervention.id}`,
                requireInteraction: true,
                vibrate: [200, 100, 200],
                data: {
                  url: `/planning/${intervention.id}`,
                  interventionId: intervention.id,
                  type: 'reminder-1h'
                }
              });

              sentRemindersRef.current.add(reminder1hKey);
              setLastNotification({
                type: 'reminder-1h',
                intervention,
                timestamp: new Date()
              });
            }

            // === RAPPEL 15 MIN AVANT (entre 10 et 20 minutes avant) ===
            const reminder15minKey = `${intervention.id}_${dateStr}_15min`;
            if (
              !sentRemindersRef.current.has(reminder15minKey) &&
              minutesUntil > 10 &&
              minutesUntil <= 20
            ) {
              logger.log('⏰ Rappel 15min avant pour:', intervention.client);

              await showLocalNotification('⚡ Intervention dans 15 minutes', {
                body: `${formatTimeDisplay(intervention.time)} - ${intervention.client}\n${intervention.address || 'Adresse non spécifiée'}`,
                tag: `reminder-15min-${intervention.id}`,
                requireInteraction: true,
                vibrate: [300, 100, 300],
                data: {
                  url: `/planning/${intervention.id}`,
                  interventionId: intervention.id,
                  type: 'reminder-15min'
                }
              });

              sentRemindersRef.current.add(reminder15minKey);
              setLastNotification({
                type: 'reminder-15min',
                intervention,
                timestamp: new Date()
              });
            }

            // === NOTIFICATION "C'EST MAINTENANT" (entre -2 et +5 minutes) ===
            const reminderNowKey = `${intervention.id}_${dateStr}_now`;
            if (
              !sentRemindersRef.current.has(reminderNowKey) &&
              minutesUntil >= -2 &&
              minutesUntil <= 5
            ) {
              logger.log('🔔 C\'est maintenant pour:', intervention.client);

              await showLocalNotification('🚀 C\'est maintenant !', {
                body: `${intervention.client}\n${intervention.service || ''}\n📍 ${intervention.address || 'Adresse non spécifiée'}`,
                tag: `reminder-now-${intervention.id}`,
                requireInteraction: true,
                vibrate: [500, 200, 500, 200, 500],
                data: {
                  url: `/planning/${intervention.id}`,
                  interventionId: intervention.id,
                  type: 'reminder-now'
                }
              });

              sentRemindersRef.current.add(reminderNowKey);
              setLastNotification({
                type: 'reminder-now',
                intervention,
                timestamp: new Date()
              });
            }
          }
        }

        // === RAPPEL MATINAL À 7H ===
        const morningKey = `morning_${todayStr}`;
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        if (
          !sentRemindersRef.current.has(morningKey) &&
          currentHour === 7 &&
          currentMinutes >= 0 &&
          currentMinutes <= 10
        ) {
          // Compter les interventions d'aujourd'hui
          const todayInterventions = interventions.filter(itv => {
            const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
            return dates.includes(todayStr);
          });

          if (todayInterventions.length > 0) {
            logger.log('☀️ Rappel matinal:', todayInterventions.length, 'interventions');

            const firstIntervention = todayInterventions[0];
            const body = todayInterventions.length === 1
              ? `${formatTimeDisplay(firstIntervention.time)} - ${firstIntervention.client}`
              : `${todayInterventions.length} interventions aujourd'hui\nPremière à ${formatTimeDisplay(firstIntervention.time)}`;

            await showLocalNotification('☀️ Bonjour ! Vos interventions du jour', {
              body,
              tag: 'morning-reminder',
              requireInteraction: false,
              vibrate: [200, 100, 200],
              data: {
                url: '/planning',
                type: 'morning-reminder'
              }
            });

            sentRemindersRef.current.add(morningKey);
            setLastNotification({
              type: 'morning-reminder',
              count: todayInterventions.length,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        logger.error('Erreur vérification rappels:', error);
      }
    };

    // Vérifier immédiatement puis toutes les 2 minutes (pour plus de précision)
    checkUpcomingInterventions();
    const intervalId = setInterval(checkUpcomingInterventions, 2 * 60 * 1000);

    // Nettoyer les anciens rappels de plus de 24h
    const cleanupInterval = setInterval(() => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      sentRemindersRef.current.forEach(key => {
        // Ne pas supprimer les clés "morning_" trop récentes
        if (key.startsWith('morning_')) {
          const dateStr = key.replace('morning_', '');
          if (new Date(dateStr).getTime() < oneDayAgo) {
            sentRemindersRef.current.delete(key);
          }
        } else {
          const parts = key.split('_');
          const dateStr = parts[1];
          if (new Date(dateStr).getTime() < oneDayAgo) {
            sentRemindersRef.current.delete(key);
          }
        }
      });
    }, 60 * 60 * 1000); // Nettoyage toutes les heures

    return () => {
      clearInterval(intervalId);
      clearInterval(cleanupInterval);
    };
  }, [userId, enabled]);

  return { lastNotification };
};

/**
 * Hook tout-en-un pour gérer les notifications push
 */
export const useRealtimePushNotifications = (userId) => {
  const push = usePushNotifications(userId);
  const { lastNotification } = useInterventionNotifications(
    userId,
    push.isEnabled
  );

  return {
    ...push,
    lastNotification
  };
};

const pushNotifications = {
  usePushNotifications,
  useInterventionNotifications,
  useRealtimePushNotifications
};

export default pushNotifications;
