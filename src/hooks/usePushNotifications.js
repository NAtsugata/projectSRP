// src/hooks/usePushNotifications.js
// Hook pour gérer les notifications push avec Supabase Realtime

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  registerServiceWorker,
  notifyNewIntervention,
  notifyInterventionUpdate,
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
 */
export const useInterventionNotifications = (userId, enabled = true) => {
  const [lastNotification, setLastNotification] = useState(null);

  useEffect(() => {
    if (!userId || !enabled || !isNotificationEnabled()) {
      return;
    }

    console.log('🔔 Écoute des interventions pour l\'utilisateur:', userId);

    // Écouter les INSERT sur la table interventions
    const interventionChannel = supabase
      .channel('interventions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interventions',
          filter: `employee_id=eq.${userId}`
        },
        async (payload) => {
          console.log('🆕 Nouvelle intervention détectée:', payload);

          try {
            await notifyNewIntervention(payload.new);
            setLastNotification({
              type: 'new',
              intervention: payload.new,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Erreur notification nouvelle intervention:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interventions',
          filter: `employee_id=eq.${userId}`
        },
        async (payload) => {
          console.log('📝 Intervention modifiée:', payload);

          try {
            // Déterminer le type de changement
            const old = payload.old;
            const updated = payload.new;

            let updateType = 'update';
            if (updated.status === 'cancelled') {
              updateType = 'cancelled';
            } else if (updated.scheduled_date !== old.scheduled_date) {
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
        console.log('📡 Statut subscription Realtime:', status);
      });

    // Cleanup
    return () => {
      console.log('🔕 Arrêt écoute interventions');
      interventionChannel.unsubscribe();
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
