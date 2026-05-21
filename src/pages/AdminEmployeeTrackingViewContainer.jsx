// src/pages/AdminEmployeeTrackingViewContainer.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminEmployeeTrackingView from './AdminEmployeeTrackingView';
import logger from '../utils/logger';

export default function AdminEmployeeTrackingViewContainer() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [profilesRes, interventionsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name')
            .order('full_name'),

          supabase
            .from('interventions')
            .select(`
              id, client, address, date, scheduled_dates, status, report,
              intervention_assignments (
                user_id,
                profiles (id, full_name)
              )
            `)
            .eq('is_archived', false)
            .order('date', { ascending: false }),
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (interventionsRes.error) throw interventionsRes.error;

        const profiles = profilesRes.data || [];
        const interventions = interventionsRes.data || [];

        // Build a lookup: userId → full_name
        const nameMap = {};
        profiles.forEach(p => { nameMap[p.id] = p.full_name; });

        // Explode: one row per (employee × intervention)
        const expanded = [];
        for (const iv of interventions) {
          const assignments = iv.intervention_assignments || [];
          if (assignments.length === 0) continue;

          const teamNames = assignments.map(a =>
            a.profiles?.full_name || nameMap[a.user_id] || 'Inconnu'
          );

          for (const assignment of assignments) {
            const userId = assignment.user_id;
            const userName = assignment.profiles?.full_name || nameMap[userId] || 'Inconnu';
            expanded.push({ userId, userName, teamNames, intervention: iv });
          }
        }

        setUsers(profiles);
        setRows(expanded);
      } catch (err) {
        logger.error('AdminEmployeeTracking load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  return <AdminEmployeeTrackingView rows={rows} users={users} isLoading={isLoading} />;
}
