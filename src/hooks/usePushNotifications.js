// src/hooks/usePushNotifications.js
// Hook pour gérer les notifications push avec Supabase Realtime
// ✅ Amélioré avec écoute des assignations et rappels programmés

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
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
      console.error('Erreur activation notifications:', error);
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

    console.log('🔔 Écoute des interventions pour l\'utilisateur:', userId);

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
          console.log('🆕 Nouvelle assignation détectée:', payload);

          try {
            // Récupérer les détails de l'intervention
            const { data: intervention } = await supabase
              .from('interventions')
              .select('*')
              .eq('id', payload.new.intervention_id)
              .single();

            if (intervention) {
              await notifyNewIntervention(intervention);
              setLastNotification({
                type: 'new',
                intervention,
                timestamp: new Date()
              });
            }
          } catch (error) {
            console.error('Erreur notification nouvelle assignation:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut subscription assignations:', status);
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
          // Vérifier si l'utilisateur est assigné à cette intervention
          const { data: assignment } = await supabase
            .from('intervention_assignments')
            .select('id')
            .eq('intervention_id', payload.new.id)
            .eq('user_id', userId)
            .single();

          if (!assignment) return; // L'utilisateur n'est pas assigné

          console.log('📝 Intervention modifiée:', payload);

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
            setLastNotification({
              type: updateType,
              intervention: updated,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Erreur notification mise à jour intervention:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut subscription interventions:', status);
      });

    // Cleanup
    return () => {
      console.log('🔕 Arrêt écoute interventions');
      assignmentChannel.unsubscribe();
      interventionChannel.unsubscribe();
    };
  }, [userId, enabled]);

  // ⏰ Rappels programmés (1h avant)
  useEffect(() => {
    if (!userId || !enabled || !isNotificationEnabled()) {
      return;
    }

    const checkUpcomingInterventions = async () => {
      try {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000);

        // Récupérer les interventions assignées à l'utilisateur
        const { data: assignments } = await supabase
          .from('intervention_assignments')
          .select('intervention_id')
          .eq('user_id', userId);

        if (!assignments || assignments.length === 0) return;

        const interventionIds = assignments.map(a => a.intervention_id);

        // Récupérer les interventions à venir
        const { data: interventions } = await supabase
          .from('interventions')
          .select('*')
          .in('id', interventionIds)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .eq('is_archived', false);

        if (!interventions) return;

        for (const intervention of interventions) {
          // Vérifier les dates programmées
          const scheduledDates = intervention.scheduled_dates || [];

          for (const dateStr of scheduledDates) {
            const scheduledDate = new Date(dateStr);

            // Rappel 1h avant
            const reminderKey = `${intervention.id}_${dateStr}_1h`;
            if (
              !sentRemindersRef.current.has(reminderKey) &&
              scheduledDate > thirtyMinLater &&
              scheduledDate <= oneHourLater
            ) {
              console.log('⏰ Rappel 1h avant pour:', intervention.client);

              await showLocalNotification('⏰ Rappel intervention dans 1h', {
                body: `${intervention.client}\n${intervention.address || 'Adresse non spécifiée'}`,
                tag: `reminder-${intervention.id}`,
                requireInteraction: true,
                data: {
                  url: `/planning/${intervention.id}`,
                  interventionId: intervention.id,
                  type: 'reminder'
                }
              });

              sentRemindersRef.current.add(reminderKey);
              setLastNotification({
                type: 'reminder',
                intervention,
                timestamp: new Date()
              });
            }
          }
        }
      } catch (error) {
        console.error('Erreur vérification rappels:', error);
      }
    };

    // Vérifier immédiatement puis toutes les 5 minutes
    checkUpcomingInterventions();
    const intervalId = setInterval(checkUpcomingInterventions, 5 * 60 * 1000);

    // Nettoyer les anciens rappels de plus de 24h
    const cleanupInterval = setInterval(() => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      sentRemindersRef.current.forEach(key => {
        const parts = key.split('_');
        const dateStr = parts[1];
        if (new Date(dateStr).getTime() < oneDayAgo) {
          sentRemindersRef.current.delete(key);
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

export default {
  usePushNotifications,
  useInterventionNotifications,
  useRealtimePushNotifications
};
