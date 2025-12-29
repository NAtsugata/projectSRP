// src/components/mobile/NotificationPermissionPrompt.js
// Composant pour demander la permission des notifications

import React, { useState, useEffect } from 'react';
import { useMobileNotifications, MobileNotificationContainer, useMobileModal, MobileModalContainer } from './MobileNotifications';
import { BellIcon, BellOffIcon, CheckCircleIcon } from '../SharedUI';
import './NotificationPermissionPrompt.css';

/**
 * Bannière de demande de permission pour les notifications
 */
export const NotificationPermissionBanner = ({ onEnable, onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    console.log('🔔 [Banner] Bouton "Plus tard" cliqué');
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  const handleEnable = () => {
    console.log('🔔 [Banner] Bouton "Activer" cliqué');
    console.log('🔔 [Banner] onEnable est:', typeof onEnable, onEnable);
    if (onEnable) {
      onEnable();
    } else {
      console.error('❌ [Banner] onEnable n\'est pas défini !');
    }
  };

  if (isDismissed) return null;

  return (
    <div className="notification-permission-banner">
      <div className="notification-permission-icon">
        <BellIcon style={{ width: 24, height: 24 }} />
      </div>
      <div className="notification-permission-content">
        <h3>Activez les notifications</h3>
        <p>Recevez des alertes pour vos nouvelles interventions</p>
      </div>
      <div className="notification-permission-actions">
        <button
          className="notification-permission-button notification-permission-button-enable"
          onClick={handleEnable}
        >
          Activer
        </button>
        <button
          className="notification-permission-button notification-permission-button-dismiss"
          onClick={handleDismiss}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
};

/**
 * Carte de statut des notifications
 */
export const NotificationStatusCard = ({ isEnabled, permission, onEnable }) => {
  const getStatusInfo = () => {
    if (permission === 'granted' && isEnabled) {
      return {
        icon: <CheckCircleIcon style={{ width: 48, height: 48, color: '#10b981' }} />,
        title: 'Notifications activées',
        message: 'Vous recevrez des alertes pour vos interventions',
        color: '#10b981',
        bgColor: '#dcfce7'
      };
    }

    if (permission === 'denied') {
      return {
        icon: <BellOffIcon style={{ width: 48, height: 48, color: '#ef4444' }} />,
        title: 'Notifications bloquées',
        message: 'Veuillez les activer dans les paramètres de votre navigateur',
        color: '#ef4444',
        bgColor: '#fee2e2'
      };
    }

    return {
      icon: <BellIcon style={{ width: 48, height: 48, color: '#f59e0b' }} />,
      title: 'Notifications désactivées',
      message: 'Activez-les pour ne rien manquer',
      color: '#f59e0b',
      bgColor: '#fef3c7'
    };
  };

  const status = getStatusInfo();

  return (
    <div className="notification-status-card" style={{ backgroundColor: status.bgColor }}>
      <div className="notification-status-icon">
        {status.icon}
      </div>
      <h3 className="notification-status-title" style={{ color: status.color }}>
        {status.title}
      </h3>
      <p className="notification-status-message">
        {status.message}
      </p>
      {!isEnabled && permission !== 'denied' && (
        <button
          className="notification-status-button"
          onClick={onEnable}
        >
          Activer les notifications
        </button>
      )}
      {permission === 'denied' && (
        <button
          className="notification-status-button notification-status-button-secondary"
          onClick={() => {
            alert('Allez dans les paramètres de votre navigateur pour activer les notifications pour ce site.');
          }}
        >
          Voir les instructions
        </button>
      )}
    </div>
  );
};

/**
 * Composant principal de gestion des notifications avec modal
 */
export const NotificationPermissionManager = ({ userId, pushNotifications }) => {
  const notifications = useMobileNotifications();
  const modal = useMobileModal();
  const [showBanner, setShowBanner] = useState(
    pushNotifications?.isSupported && !pushNotifications?.isEnabled
  );

  // Logs de débogage
  useEffect(() => {
    console.log('🔔 NotificationPermissionManager - État:', {
      userId,
      isSupported: pushNotifications?.isSupported,
      isEnabled: pushNotifications?.isEnabled,
      permission: pushNotifications?.permission,
      isRegistering: pushNotifications?.isRegistering,
      hasRequestPermission: typeof pushNotifications?.requestPermission === 'function'
    });
  }, [userId, pushNotifications]);

  const handleEnableNotifications = async () => {
    console.log('🔔 Tentative d\'activation des notifications...');

    if (!pushNotifications || !pushNotifications.requestPermission) {
      console.error('❌ pushNotifications non disponible:', pushNotifications);
      notifications.error('Notifications non disponibles', {
        duration: 4000
      });
      return;
    }

    try {
      const granted = await pushNotifications.requestPermission();

      if (granted) {
        notifications.success('Notifications activées !', {
          duration: 3000
        });
        setShowBanner(false);
      } else {
        notifications.error('Permission refusée', {
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Erreur activation notifications:', error);
      notifications.error('Erreur: ' + error.message, {
        duration: 5000
      });
    }
  };

  if (!pushNotifications?.isSupported) {
    return null;
  }

  return (
    <>
      {showBanner && (
        <NotificationPermissionBanner
          onEnable={handleEnableNotifications}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <MobileNotificationContainer
        notifications={notifications.notifications}
        onDismiss={notifications.removeNotification}
      />

      <MobileModalContainer
        modal={modal.modal}
        onClose={modal.hideModal}
      />
    </>
  );
};

/**
 * Hook pour afficher automatiquement le prompt de permission
 */
export const useNotificationPermissionPrompt = (pushNotifications, delay = 5000) => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!pushNotifications?.isSupported || pushNotifications?.isEnabled) {
      return;
    }

    // Vérifier si l'utilisateur a déjà refusé une fois
    const dismissed = localStorage.getItem('notification-prompt-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

      // Ne pas redemander pendant 7 jours
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Attendre un délai avant d'afficher le prompt
    const timer = setTimeout(() => {
      setShouldShow(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [pushNotifications, delay]);

  const handleDismiss = () => {
    setShouldShow(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  return {
    shouldShow,
    handleDismiss
  };
};

export default {
  NotificationPermissionBanner,
  NotificationStatusCard,
  NotificationPermissionManager,
  useNotificationPermissionPrompt
};
