// src/components/dashboard/RecentActivity.js
// Liste des activités récentes avec timeline

import React from 'react';
import './RecentActivity.css';

/**
 * ActivityItem
 */
const ActivityItem = ({ icon, title, description, time, variant = 'default' }) => {
  return (
    <div className={`activity-item activity-item-${variant}`}>
      <div className="activity-icon">
        {icon}
      </div>
      <div className="activity-content">
        <p className="activity-title">{title}</p>
        {description && <p className="activity-description">{description}</p>}
        {time && <p className="activity-time">{time}</p>}
      </div>
    </div>
  );
};

/**
 * RecentActivity Component
 *
 * @param {Array} activities - Liste des activités [{icon, title, description, time, variant}]
 * @param {string} title - Titre de la section (default: "Activité récente")
 * @param {number} maxItems - Nombre max d'items à afficher (default: 5)
 * @param {React.ReactNode} emptyMessage - Message si aucune activité
 */
const RecentActivity = ({
  activities = [],
  title = 'Activité récente',
  maxItems = 5,
  emptyMessage = 'Aucune activité récente'
}) => {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="recent-activity">
      <h3 className="recent-activity-title">{title}</h3>

      {displayedActivities.length > 0 ? (
        <div className="activity-list">
          {displayedActivities.map((activity, index) => (
            <ActivityItem
              key={index}
              icon={activity.icon}
              title={activity.title}
              description={activity.description}
              time={activity.time}
              variant={activity.variant}
            />
          ))}
        </div>
      ) : (
        <div className="activity-empty">
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
