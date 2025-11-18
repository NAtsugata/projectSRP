// src/components/agenda/EmployeeSelect.js
// Select avancé avec recherche et groupement pour les employés

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { XIcon, SearchIcon, UsersIcon, ChevronDownIcon } from '../SharedUI';
import './EmployeeSelect.css';

/**
 * Groupe les employés par équipe/département
 * Si pas de team_name, met dans "Non assignés"
 */
const groupEmployeesByTeam = (employees) => {
  const groups = {};

  employees.forEach(emp => {
    const team = emp.team_name || 'Non assignés';
    if (!groups[team]) {
      groups[team] = [];
    }
    groups[team].push(emp);
  });

  return groups;
};

/**
 * EmployeeSelect Component
 * @param {Array} employees - Liste des employés
 * @param {Array} selectedIds - IDs des employés sélectionnés
 * @param {Function} onChange - Callback quand la sélection change
 * @param {string} placeholder - Texte du placeholder
 */
const EmployeeSelect = ({
  employees = [],
  selectedIds = [],
  onChange,
  placeholder = 'Sélectionner des intervenants...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Grouper les employés
  const groupedEmployees = useMemo(() => {
    return groupEmployeesByTeam(employees);
  }, [employees]);

  // Filtrer par recherche
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedEmployees;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(groupedEmployees).forEach(([team, emps]) => {
      const matchingEmps = emps.filter(emp =>
        emp.full_name?.toLowerCase().includes(query) ||
        team.toLowerCase().includes(query)
      );

      if (matchingEmps.length > 0) {
        filtered[team] = matchingEmps;
      }
    });

    return filtered;
  }, [groupedEmployees, searchQuery]);

  // Employés sélectionnés
  const selectedEmployees = useMemo(() => {
    return employees.filter(emp => selectedIds.includes(emp.id));
  }, [employees, selectedIds]);

  // Handlers
  const handleToggleEmployee = (employeeId) => {
    const newSelection = selectedIds.includes(employeeId)
      ? selectedIds.filter(id => id !== employeeId)
      : [...selectedIds, employeeId];

    onChange(newSelection);
  };

  const handleSelectAll = () => {
    onChange(employees.map(emp => emp.id));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleRemoveBadge = (employeeId) => {
    onChange(selectedIds.filter(id => id !== employeeId));
  };

  const handleSelectTeam = (teamEmployees) => {
    const teamIds = teamEmployees.map(emp => emp.id);
    const allSelected = teamIds.every(id => selectedIds.includes(id));

    if (allSelected) {
      // Déselectionner toute l'équipe
      onChange(selectedIds.filter(id => !teamIds.includes(id)));
    } else {
      // Sélectionner toute l'équipe
      const newSelection = [...new Set([...selectedIds, ...teamIds])];
      onChange(newSelection);
    }
  };

  return (
    <div className="employee-select" ref={containerRef}>
      <label className="employee-select-label">
        <UsersIcon className="label-icon" />
        Intervenants
      </label>

      {/* Badges des sélectionnés */}
      {selectedEmployees.length > 0 && (
        <div className="employee-badges">
          {selectedEmployees.map(emp => (
            <span key={emp.id} className="employee-badge">
              {emp.full_name}
              <button
                type="button"
                onClick={() => handleRemoveBadge(emp.id)}
                className="badge-remove"
                aria-label={`Retirer ${emp.full_name}`}
              >
                <XIcon />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Bouton d'ouverture */}
      <button
        type="button"
        className={`employee-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="trigger-text">
          {selectedEmployees.length > 0
            ? `${selectedEmployees.length} sélectionné(s)`
            : placeholder}
        </span>
        <ChevronDownIcon className={`trigger-icon ${isOpen ? 'rotate' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="employee-dropdown" role="listbox">
          {/* Barre de recherche */}
          <div className="dropdown-search">
            <SearchIcon className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Rechercher un intervenant ou une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Actions rapides */}
          <div className="dropdown-actions">
            <button
              type="button"
              className="action-button"
              onClick={handleSelectAll}
            >
              Tout sélectionner
            </button>
            <button
              type="button"
              className="action-button"
              onClick={handleDeselectAll}
              disabled={selectedIds.length === 0}
            >
              Tout désélectionner
            </button>
          </div>

          {/* Liste groupée */}
          <div className="dropdown-list">
            {Object.keys(filteredGroups).length === 0 ? (
              <div className="dropdown-empty">
                Aucun intervenant trouvé
              </div>
            ) : (
              Object.entries(filteredGroups).map(([team, teamEmployees]) => {
                const allSelected = teamEmployees.every(emp => selectedIds.includes(emp.id));
                const someSelected = teamEmployees.some(emp => selectedIds.includes(emp.id));

                return (
                  <div key={team} className="employee-group">
                    <button
                      type="button"
                      className="group-header"
                      onClick={() => handleSelectTeam(teamEmployees)}
                    >
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={input => {
                          if (input) input.indeterminate = someSelected && !allSelected;
                        }}
                        readOnly
                        className="group-checkbox"
                      />
                      <span className="group-name">
                        📦 {team}
                      </span>
                      <span className="group-count">({teamEmployees.length})</span>
                    </button>

                    <div className="group-items">
                      {teamEmployees.map(emp => (
                        <label
                          key={emp.id}
                          className="employee-item"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(emp.id)}
                            onChange={() => handleToggleEmployee(emp.id)}
                            className="employee-checkbox"
                          />
                          <span className="employee-name">{emp.full_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSelect;
