// src/components/NotificationCenter.js
// Centre de notifications avec historique et gestion des alertes

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationCenter.css';

/**
 * Centre de notifications - Affiche l'historique et permet de gérer les alertes
 */
const NotificationCenter = ({
    isOpen,
    onClose,
    lastNotification,
    onClearAll
}) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    // Ajouter une nouvelle notification quand elle arrive
    useEffect(() => {
        if (lastNotification) {
            setNotifications(prev => {
                // Éviter les doublons
                const exists = prev.some(n =>
                    n.intervention?.id === lastNotification.intervention?.id &&
                    n.type === lastNotification.type &&
                    Math.abs(new Date(n.timestamp) - new Date(lastNotification.timestamp)) < 1000
                );

                if (exists) return prev;

                return [
                    {
                        ...lastNotification,
                        id: `${lastNotification.intervention?.id}-${Date.now()}`,
                        read: false
                    },
                    ...prev
                ].slice(0, 50); // Garder max 50 notifications
            });
            setUnreadCount(prev => prev + 1);
        }
    }, [lastNotification]);

    // Marquer toutes comme lues quand on ouvre le panneau
    useEffect(() => {
        if (isOpen) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        }
    }, [isOpen]);

    const handleNotificationClick = (notification) => {
        if (notification.intervention?.id) {
            navigate(`/planning/${notification.intervention.id}`);
            onClose();
        }
    };

    const handleClearAll = () => {
        setNotifications([]);
        setUnreadCount(0);
        if (onClearAll) onClearAll();
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'new': return '🔔';
            case 'update': return '📝';
            case 'cancelled': return '❌';
            case 'rescheduled': return '📅';
            case 'urgent': return '🚨';
            case 'reminder': return '⏰';
            default: return '📬';
        }
    };

    const getNotificationTitle = (type) => {
        switch (type) {
            case 'new': return 'Nouvelle intervention';
            case 'update': return 'Intervention modifiée';
            case 'cancelled': return 'Intervention annulée';
            case 'rescheduled': return 'Intervention reportée';
            case 'urgent': return 'URGENT';
            case 'reminder': return 'Rappel';
            default: return 'Notification';
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays === 1) return 'Hier';
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    if (!isOpen) {
        return (
            <NotificationBadge
                count={unreadCount}
                onClick={() => onClose()} // Toggle via parent
            />
        );
    }

    return (
        <>
            <div className="notification-overlay" onClick={onClose} />
            <div className="notification-center">
                <div className="notification-header">
                    <h3>🔔 Notifications</h3>
                    <div className="notification-actions">
                        {notifications.length > 0 && (
                            <button
                                className="clear-all-btn"
                                onClick={handleClearAll}
                            >
                                Tout effacer
                            </button>
                        )}
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="notification-list">
                    {notifications.length === 0 ? (
                        <div className="no-notifications">
                            <span className="empty-icon">📭</span>
                            <p>Aucune notification</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`notification-item ${notification.read ? '' : 'unread'} ${notification.type}`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="notification-icon">
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="notification-content">
                                    <div className="notification-title">
                                        {getNotificationTitle(notification.type)}
                                    </div>
                                    <div className="notification-body">
                                        {notification.intervention?.client || 'Intervention'}
                                    </div>
                                    <div className="notification-meta">
                                        {notification.intervention?.address && (
                                            <span className="notification-address">
                                                📍 {notification.intervention.address}
                                            </span>
                                        )}
                                        <span className="notification-time">
                                            {formatTimestamp(notification.timestamp)}
                                        </span>
                                    </div>
                                </div>
                                {!notification.read && <div className="unread-dot" />}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

/**
 * Badge de notification pour le header
 */
export const NotificationBadge = ({ count, onClick }) => {
    return (
        <button
            className="notification-badge-btn"
            onClick={onClick}
            aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ''}`}
        >
            <span className="bell-icon">🔔</span>
            {count > 0 && (
                <span className="badge-count">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
};

export default NotificationCenter;
