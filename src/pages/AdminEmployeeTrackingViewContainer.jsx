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
              daily_assignments,
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

        const expanded = [];

        for (const iv of interventions) {
          // ── Collecter tous les userIds depuis les deux systèmes ──

          // Système 1 : intervention_assignments (table relationnelle)
          const assignMap = {}; // userId → full_name
          for (const a of (iv.intervention_assignments || [])) {
            if (!a?.user_id) continue;
            assignMap[a.user_id] = a.profiles?.full_name || nameMap[a.user_id] || 'Inconnu';
          }

          // Système 2 : daily_assignments (JSONB { "YYYY-MM-DD": ["userId", ...] })
          const dailyMap = iv.daily_assignments;
          if (dailyMap && typeof dailyMap === 'object') {
            for (const userIds of Object.values(dailyMap)) {
              if (!Array.isArray(userIds)) continue;
              for (const uid of userIds) {
                if (uid && !assignMap[uid]) {
                  assignMap[uid] = nameMap[uid] || 'Inconnu';
                }
              }
            }
          }

          if (Object.keys(assignMap).length === 0) continue;

          // Nombre de jours : scheduled_dates ou entrées daily_assignments ou 1
          let days = 1;
          if (Array.isArray(iv.scheduled_dates) && iv.scheduled_dates.length > 0) {
            days = iv.scheduled_dates.length;
          } else if (dailyMap && typeof dailyMap === 'object') {
            const dayCount = Object.keys(dailyMap).length;
            if (dayCount > 0) days = dayCount;
          }

          const teamNames = Object.values(assignMap);

          for (const [userId, userName] of Object.entries(assignMap)) {
            // Jours travaillés par cet employé spécifiquement selon daily_assignments
            let userDays = days;
            if (dailyMap && typeof dailyMap === 'object') {
              const personalDays = Object.values(dailyMap).filter(
                uids => Array.isArray(uids) && uids.includes(userId)
              ).length;
              if (personalDays > 0) userDays = personalDays;
            }

            expanded.push({ userId, userName, teamNames, intervention: iv, days: userDays });
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
