// src/components/ui/Tabs.jsx
// Composant d'onglets réutilisable et moderne

import React, { useState } from 'react';
import './Tabs.css';

export const Tabs = ({ children, defaultTab = 0, activeTab: controlledTab, onChange }) => {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;

  const handleTabChange = (index) => {
    if (controlledTab === undefined) setInternalTab(index);
    if (onChange) onChange(index);
  };

  const tabs = React.Children.toArray(children);

  return (
    <div className="tabs-container">
      {/* En-têtes des onglets */}
      <div className="tabs-header">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`tab-button ${activeTab === index ? 'active' : ''}`}
            onClick={() => handleTabChange(index)}
            type="button"
          >
            {tab.props.icon && <span className="tab-icon">{tab.props.icon}</span>}
            <span className="tab-label">{tab.props.label}</span>
            {tab.props.badge && (
              <span className="tab-badge">{tab.props.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="tabs-content">
        {tabs[activeTab]}
      </div>
    </div>
  );
};

export const Tab = ({ children }) => {
  return <div className="tab-pane">{children}</div>;
};

export default Tabs;
