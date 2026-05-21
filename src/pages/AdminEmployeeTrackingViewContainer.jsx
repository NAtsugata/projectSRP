// src/pages/AdminEmployeeTrackingViewContainer.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminEmployeeTrackingView from './AdminEmployeeTrackingView';
import logger from '../utils/logger';

export default function AdminEmployeeTrackingViewContainer() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
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
            .order('date', { ascending: false })
            .limit(2000),
        ]);

        if (cancelled) return;
        if (profilesRes.error) throw profilesRes.error;
        if (interventionsRes.error) throw interventionsRes.error;

        const profiles = (profilesRes.data || []).filter(p => p.id);
        const interventions = interventionsRes.data || [];

        // Lookup: userId → full_name
        const nameMap = {};
        profiles.forEach(p => { nameMap[p.id] = p.full_name || 'Sans nom'; });

        // Dedupe assignments per intervention (user_id) to avoid duplicates
        const expanded = [];
        for (const iv of interventions) {
          const seen = new Set();
          const assignments = (iv.intervention_assignments || []).filter(a => {
            if (!a?.user_id || seen.has(a.user_id)) return false;
            seen.add(a.user_id);
            return true;
          });
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

        if (!cancelled) {
          setUsers(profiles);
          setRows(expanded);
        }
      } catch (err) {
        logger.error('AdminEmployeeTracking load error:', err);
        if (!cancelled) setError(err.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#991b1b' }}>
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Réessayer
        </button>
      </div>
    );
  }

  return <AdminEmployeeTrackingView rows={rows} users={users} isLoading={isLoading} />;
}
