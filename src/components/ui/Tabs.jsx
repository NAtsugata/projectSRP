// src/components/ui/Tabs.jsx
// Composant d'onglets réutilisable et moderne

import React, { useState,useId } from 'react';
import './Tabs.css';

export const Tabs = ({ children, defaultTab = 0, value, onChange }) => {
  const [localTab, setActiveTab] = useState(defaultTab),id=useId();
  const activeTab=value ?? localTab;

  const handleTabChange = (index) => {
    setActiveTab(index);
    if (onChange) onChange(index);
  };

  const tabs = React.Children.toArray(children);

  return (
    <div className="tabs-container">
      {/* En-têtes des onglets */}
      <div className="tabs-header" role="tablist" aria-label="Rubriques de la fiche">
        {tabs.map((tab, index) => (
          <button
            key={index}
            id={`${id}-tab-${index}`}
            role="tab"
            aria-selected={activeTab===index}
            aria-controls={`${id}-panel`}
            tabIndex={activeTab===index?0:-1}
            onKeyDown={e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();handleTabChange(next);document.getElementById(`${id}-tab-${next}`)?.focus();}}}
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
      <div className="tabs-content" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${activeTab}`}>
        {tabs[activeTab]}
      </div>
    </div>
  );
};

export const Tab = ({ children }) => {
  return <div className="tab-pane">{children}</div>;
};

export default Tabs;
