// src/components/mobile/MobileNotifications.js
// Système de notifications optimisé pour mobile avec vibrations et animations
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon, XIcon } from '../SharedUI';

/**
 * Hook pour gérer les notifications mobiles
 */
export const useMobileNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [nextId, setNextId] = useState(0);

  const addNotification = useCallback((notification) => {
    const id = nextId;
    setNextId(prev => prev + 1);

    const newNotification = {
      id,
      type: notification.type || 'info', // success, error, warning, info
      message: notification.message,
      duration: notification.duration || 3000,
      vibrate: notification.vibrate !== false, // true par défaut
      sound: notification.sound !== false, // true par défaut
      action: notification.action, // { label: 'Action', onClick: () => {} }
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // ✅ Vibration mobile selon le type
    if (newNotification.vibrate && navigator.vibrate) {
      switch (newNotification.type) {
        case 'success':
          navigator.vibrate([50, 50, 50]); // 3 courtes vibrations
          break;
        case 'error':
          navigator.vibrate([100, 50, 100, 50, 100]); // Pattern d'erreur
          break;
        case 'warning':
          navigator.vibrate([200, 100, 200]); // Pattern d'avertissement
          break;
        default:
          navigator.vibrate(50); // Simple vibration
      }
    }

    // Auto-suppression après la durée
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [nextId]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Helpers pour les types courants
  const success = useCallback((message, options = {}) => {
    return addNotification({ type: 'success', message, ...options });
  }, [addNotification]);

  const error = useCallback((message, options = {}) => {
    return addNotification({ type: 'error', message, duration: 5000, ...options });
  }, [addNotification]);

  const warning = useCallback((message, options = {}) => {
    return addNotification({ type: 'warning', message, duration: 4000, ...options });
  }, [addNotification]);

  const info = useCallback((message, options = {}) => {
    return addNotification({ type: 'info', message, ...options });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  };
};

/**
 * Composant d'affichage des notifications
 */
export const MobileNotificationContainer = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="mobile-notifications-container">
      {notifications.map((notification) => (
        <MobileNotification
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
};

/**
 * Composant de notification individuelle
 */
const MobileNotification = ({ notification, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Durée de l'animation de sortie
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircleIcon />;
      case 'error':
        return <AlertCircleIcon />;
      case 'warning':
        return <AlertTriangleIcon />;
      default:
        return <AlertCircleIcon />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return '#10b981'; // Green
      case 'error':
        return '#ef4444'; // Red
      case 'warning':
        return '#f59e0b'; // Orange
      default:
        return '#3b82f6'; // Blue
    }
  };

  return (
    <div
      className={`mobile-notification ${notification.type} ${isExiting ? 'exiting' : ''}`}
      style={{
        backgroundColor: getBackgroundColor(),
        animation: isExiting ? 'slideOut 0.3s ease-out' : 'slideIn 0.3s ease-out'
      }}
    >
      <div className="mobile-notification-icon">
        {getIcon()}
      </div>
      <div className="mobile-notification-content">
        <p className="mobile-notification-message">{notification.message}</p>
        {notification.action && (
          <button
            className="mobile-notification-action"
            onClick={() => {
              notification.action.onClick();
              handleDismiss();
            }}
          >
            {notification.action.label}
          </button>
        )}
      </div>
      <button className="mobile-notification-close" onClick={handleDismiss}>
        <XIcon />
      </button>
    </div>
  );
};

/**
 * Hook pour afficher une popup modale mobile
 */
export const useMobileModal = () => {
  const [modal, setModal] = useState(null);

  const showModal = useCallback((options) => {
    setModal({
      title: options.title,
      message: options.message,
      type: options.type || 'info', // success, error, warning, info, confirm
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: options.cancelLabel || 'Annuler',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
      showCancel: options.showCancel !== false && options.type === 'confirm',
    });

    // Vibration pour attirer l'attention
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  }, []);

  const hideModal = useCallback(() => {
    setModal(null);
  }, []);

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      showModal({
        type: 'confirm',
        title,
        message,
        showCancel: true,
        onConfirm: () => {
          hideModal();
          resolve(true);
        },
        onCancel: () => {
          hideModal();
          resolve(false);
        }
      });
    });
  }, [showModal, hideModal]);

  const alert = useCallback((title, message, type = 'info') => {
    return new Promise((resolve) => {
      showModal({
        type,
        title,
        message,
        showCancel: false,
        onConfirm: () => {
          hideModal();
          resolve();
        }
      });
    });
  }, [showModal, hideModal]);

  return {
    modal,
    showModal,
    hideModal,
    confirm,
    alert
  };
};

/**
 * Composant de popup modale mobile
 */
export const MobileModalContainer = ({ modal, onClose }) => {
  if (!modal) return null;

  const getIcon = () => {
    switch (modal.type) {
      case 'success':
        return <CheckCircleIcon style={{ width: 64, height: 64, color: '#10b981' }} />;
      case 'error':
        return <AlertCircleIcon style={{ width: 64, height: 64, color: '#ef4444' }} />;
      case 'warning':
        return <AlertTriangleIcon style={{ width: 64, height: 64, color: '#f59e0b' }} />;
      case 'confirm':
        return <AlertCircleIcon style={{ width: 64, height: 64, color: '#3b82f6' }} />;
      default:
        return <AlertCircleIcon style={{ width: 64, height: 64, color: '#6b7280' }} />;
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      if (modal.onCancel) {
        modal.onCancel();
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="mobile-modal-backdrop" onClick={handleBackdropClick}>
      <div className="mobile-modal">
        <div className="mobile-modal-icon">
          {getIcon()}
        </div>
        {modal.title && (
          <h3 className="mobile-modal-title">{modal.title}</h3>
        )}
        <p className="mobile-modal-message">{modal.message}</p>
        <div className="mobile-modal-actions">
          {modal.showCancel && (
            <button
              className="mobile-modal-button mobile-modal-button-cancel"
              onClick={() => {
                if (modal.onCancel) modal.onCancel();
                onClose();
              }}
            >
              {modal.cancelLabel}
            </button>
          )}
          <button
            className="mobile-modal-button mobile-modal-button-confirm"
            onClick={() => {
              if (modal.onConfirm) modal.onConfirm();
              onClose();
            }}
          >
            {modal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook de confirmation rapide avec retour de promesse
 */
export const useConfirm = () => {
  const { confirm } = useMobileModal();
  return confirm;
};

/**
 * Composant tout-en-un pour les notifications et modales
 */
export const MobileNotificationProvider = ({ children }) => {
  const notifications = useMobileNotifications();
  const modal = useMobileModal();

  return (
    <>
      {children}
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

export default {
  useMobileNotifications,
  useMobileModal,
  useConfirm,
  MobileNotificationContainer,
  MobileModalContainer,
  MobileNotificationProvider
};
