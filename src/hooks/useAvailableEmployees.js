// src/hooks/useAvailableEmployees.js
// Filtre une liste d'employés pour ne garder que ceux DISPONIBLES à la/aux
// date(s) visée(s) : ni licenciés, ni absents (maladie / congé / autre).

import { useState, useEffect, useMemo } from 'react';
import { availabilityService } from '../services/availabilityService';
import { filterEmployable } from '../utils/employeeAvailability';

/**
 * @param {Array} users - liste complète des employés (profils)
 * @param {string|string[]} dates - date(s) 'YYYY-MM-DD' visée(s)
 * @returns {{ availableUsers: Array, unavailableUsers: Array, absentIds: Set, loading: boolean }}
 */
export function useAvailableEmployees(users = [], dates = []) {
  const dateList = useMemo(() => {
    const arr = Array.isArray(dates) ? dates : (dates ? [dates] : []);
    return arr.filter(Boolean);
  }, [dates]);

  // Clé stable (bornes de la période) pour éviter les refetch inutiles
  const rangeKey = useMemo(() => {
    if (!dateList.length) return '';
    const sorted = [...dateList].sort();
    return `${sorted[0]}|${sorted[sorted.length - 1]}`;
  }, [dateList]);

  const [absentIds, setAbsentIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!rangeKey) {
      setAbsentIds(new Set());
      return undefined;
    }
    const [start, end] = rangeKey.split('|');
    setLoading(true);
    availabilityService.getUnavailableIds(start, end)
      .then(({ ids }) => { if (active) setAbsentIds(ids || new Set()); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rangeKey]);

  return useMemo(() => {
    const employable = filterEmployable(users);
    const availableUsers = employable.filter(u => !absentIds.has(u.id));
    const availableSet = new Set(availableUsers.map(u => u.id));
    const unavailableUsers = users.filter(u => !availableSet.has(u.id));
    return { availableUsers, unavailableUsers, absentIds, loading };
  }, [users, absentIds, loading]);
}

export default useAvailableEmployees;
