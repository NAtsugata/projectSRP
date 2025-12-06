// src/services/pushNotificationService.js
// Service de gestion des notifications push natives

/**
 * Vérifie si les notifications sont supportées
 */
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Vérifie si les notifications sont activées
 */
export const isNotificationEnabled = () => {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
};

/**
 * Demande la permission pour les notifications
 */
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    throw new Error('Les notifications ne sont pas supportées par ce navigateur');
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    throw new Error('Les notifications ont été refusées. Veuillez les activer dans les paramètres de votre navigateur.');
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Enregistre le Service Worker
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker non supporté');
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('✅ Service Worker enregistré:', registration);
    return registration;
  } catch (error) {
    console.error('❌ Erreur Service Worker:', error);
    throw error;
  }
};

/**
 * Affiche une notification locale (sans serveur)
 */
export const showLocalNotification = async (title, options = {}) => {
  if (!isNotificationEnabled()) {
    console.warn('Notifications désactivées');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const notificationOptions = {
      body: options.body || '',
      icon: options.icon || '/logo192.png',
      badge: options.badge || '/logo192.png',
      tag: options.tag || 'default-notification',
      requireInteraction: options.requireInteraction !== false,
      vibrate: options.vibrate || [200, 100, 200],
      data: options.data || {},
      actions: options.actions || [],
      ...options
    };

    await registration.showNotification(title, notificationOptions);
    console.log('✅ Notification affichée:', title);
  } catch (error) {
    console.error('❌ Erreur affichage notification:', error);
    throw error;
  }
};

/**
 * Ferme toutes les notifications avec un tag spécifique
 */
export const closeNotificationsByTag = async (tag) => {
  if (!isNotificationSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag });

    notifications.forEach((notification) => {
      notification.close();
    });
  } catch (error) {
    console.error('❌ Erreur fermeture notifications:', error);
  }
};

/**
 * Notifie une nouvelle intervention assignée
 */
export const notifyNewIntervention = async (intervention) => {
  const title = '🔔 Nouvelle intervention';
  const body = `${intervention.client}\n${intervention.address}`;

  const options = {
    body,
    tag: `intervention-${intervention.id}`,
    icon: '/logo192.png',
    badge: '/logo192.png',
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: `/planning/${intervention.id}`,
      interventionId: intervention.id,
      type: 'new-intervention'
    },
    actions: [
      {
        action: 'view',
        title: 'Voir',
        icon: '/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Plus tard',
        icon: '/icons/dismiss.png'
      }
    ]
  };

  await showLocalNotification(title, options);
};

/**
 * Notifie un changement d'intervention
 */
export const notifyInterventionUpdate = async (intervention, updateType = 'update') => {
  const titles = {
    update: '📝 Intervention modifiée',
    cancelled: '❌ Intervention annulée',
    rescheduled: '📅 Intervention reportée',
    urgent: '🚨 URGENT - Intervention'
  };

  const title = titles[updateType] || titles.update;
  const body = `${intervention.client}\n${intervention.address}`;

  const options = {
    body,
    tag: `intervention-update-${intervention.id}`,
    requireInteraction: updateType === 'urgent',
    vibrate: updateType === 'urgent' ? [500, 200, 500, 200, 500] : [200, 100, 200],
    data: {
      url: `/planning/${intervention.id}`,
      interventionId: intervention.id,
      type: `intervention-${updateType}`
    }
  };

  await showLocalNotification(title, options);
};

/**
 * Notifie un message ou commentaire
 */
export const notifyMessage = async (message, sender) => {
  const title = `💬 Message de ${sender}`;

  const options = {
    body: message,
    tag: 'message',
    requireInteraction: false,
    vibrate: [100, 50, 100],
    data: {
      type: 'message'
    }
  };

  await showLocalNotification(title, options);
};

/**
 * Teste les notifications
 */
export const testNotification = async () => {
  const title = '✅ Notifications activées !';
  const options = {
    body: 'Cliquez ici pour aller au planning. Vous recevrez des notifications pour vos interventions.',
    tag: 'test',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/planning',
      type: 'test'
    }
  };

  await showLocalNotification(title, options);
};

const pushNotificationService = {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  registerServiceWorker,
  showLocalNotification,
  closeNotificationsByTag,
  notifyNewIntervention,
  notifyInterventionUpdate,
  notifyMessage,
  testNotification
};

export default pushNotificationService;
