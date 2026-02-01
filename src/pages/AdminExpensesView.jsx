// src/pages/AdminExpensesView.js - GESTION ADMIN NOTES DE FRAIS
import React, { useState, useMemo, useEffect } from 'react';
import { UserExpensesAccordion } from '../components/expenses';
import * as expenseStatsService from '../services/expenseStatsService';
import '../components/expenses/ExpensesStyles.css';
import logger from '../utils/logger';

export default function AdminExpensesView({ users = [], expenses = [], onApproveExpense, onRejectExpense, onDeleteExpense, onMarkAsPaid, filters, onUpdateFilters }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [globalStats, setGlobalStats] = useState({
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
    total: 0
  });
  // eslint-disable-next-line no-unused-vars
  const [_statsLoading, setStatsLoading] = useState(true);

  // Catégories de frais
  const categories = [
    { value: 'transport', label: '🚗 Transport', color: '#3b82f6' },
    { value: 'meals', label: '🍽️ Repas', color: '#10b981' },
    { value: 'accommodation', label: '🏨 Hébergement', color: '#8b5cf6' },
    { value: 'supplies', label: '📦 Fournitures', color: '#f59e0b' },
    { value: 'phone', label: '📱 Téléphone', color: '#06b6d4' },
    { value: 'parking', label: '🅿️ Parking', color: '#6366f1' },
    { value: 'fuel', label: '⛽ Carburant', color: '#ef4444' },
    { value: 'other', label: '📋 Autres', color: '#64748b' }
  ];

  const handlePeriodChange = (period) => {
    if (!onUpdateFilters) return;
    if (period === 'all') {
      onUpdateFilters({});
    } else if (period === '3m') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      onUpdateFilters({ startDate: d.toISOString().split('T')[0] });
    } else if (period === '6m') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      onUpdateFilters({ startDate: d.toISOString().split('T')[0] });
    }
  };

  // Charger les statistiques globales
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data, error } = await expenseStatsService.getGlobalStats();

        if (error) {
          logger.error('Erreur lors du chargement des stats:', error);
          // Fallback: calculer côté client
          const pending = expenses.filter(e => e.status === 'pending');
          const approved = expenses.filter(e => e.status === 'approved' && !e.is_paid);
          const paid = expenses.filter(e => e.is_paid);
          const rejected = expenses.filter(e => e.status === 'rejected');

          setGlobalStats({
            pending: { count: pending.length, total: pending.reduce((sum, e) => sum + (e.amount || 0), 0) },
            approved: { count: approved.length, total: approved.reduce((sum, e) => sum + (e.amount || 0), 0) },
            paid: { count: paid.length, total: paid.reduce((sum, e) => sum + (e.amount || 0), 0) },
            rejected: { count: rejected.length, total: rejected.reduce((sum, e) => sum + (e.amount || 0), 0) },
            total: expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
          });
        } else if (data) {
          setGlobalStats({
            ...data,
            total: expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
          });
        }
      } catch (err) {
        logger.error('Erreur inattendue:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [expenses]);

  // Regroupement par utilisateur
  const expensesByUser = useMemo(() => {
    let filtered = expenses;
    if (filterStatus !== 'all') {
      if (filterStatus === 'paid') {
        filtered = expenses.filter(e => e.is_paid);
      } else if (filterStatus === 'approved') {
        filtered = expenses.filter(e => e.status === 'approved' && !e.is_paid);
      } else {
        filtered = expenses.filter(e => e.status === filterStatus);
      }
    }

    return filtered.reduce((acc, expense) => {
      const userId = expense.user_id;
      if (!acc[userId]) {
        const user = users.find(u => u.id === userId);
        acc[userId] = {
          userName: user ? user.full_name : 'Utilisateur inconnu',
          expenses: []
        };
      }
      acc[userId].expenses.push(expense);
      return acc;
    }, {});
  }, [expenses, users, filterStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div>
      <style>{`
        .user-accordion {
          background: var(--bg-primary, white);
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: visible;
          color: var(--text-primary, #1f2937);
        }
        .accordion-header {
          width: 100%;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          background-color: var(--bg-primary, white);
          border: none;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          text-align: left;
          border-radius: 0.5rem 0.5rem 0 0;
        }
        .accordion-header:hover {
          background-color: var(--bg-secondary, #f9fafb);
        }
        .accordion-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          font-size: 1rem;
          color: var(--text-primary, #1f2937);
        }
        .document-count {
          font-size: 0.875rem;
          color: var(--text-secondary, #6c757d);
          font-weight: normal;
          background-color: var(--bg-secondary, #e9ecef);
          padding: 2px 8px;
          border-radius: 12px;
        }
        .accordion-chevron {
          transition: transform 0.2s ease;
          color: var(--text-secondary, #6c757d);
        }
        .accordion-chevron.open {
          transform: rotate(180deg);
        }
        .accordion-content {
          padding: 0.5rem 1rem 1rem 1rem;
          max-height: none;
          overflow: visible;
        }
        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .filter-tab {
          padding: 0.5rem 1rem;
          border: 2px solid var(--border-color, #e5e7eb);
          background: var(--bg-primary, white);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--text-primary, #374151);
        }
        .filter-tab.active {
          background: var(--copper-main, #CD7F32);
          color: white;
          border-color: var(--copper-main, #CD7F32);
        }
        .accordion-content {
          background: var(--bg-primary, white);
          color: var(--text-primary, #1f2937);
        }
      `}</style>

      <h2 className="view-title">💰 Notes de Frais - Administration</h2>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', alignItems: 'center', gap: '1rem' }}>
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>Période :</span>
        <select
          className="form-control"
          onChange={(e) => handlePeriodChange(e.target.value)}
          defaultValue="3m"
          style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd', minWidth: '150px' }}
        >
          <option value="3m">3 derniers mois</option>
          <option value="6m">6 derniers mois</option>
          <option value="all">Tout (peut être long)</option>
        </select>
      </div>

      {/* Statistiques globales */}
      <div className="expense-stats-grid">
        <div className="stat-card warning">
          <div className="stat-label">EN ATTENTE</div>
          <div className="stat-value">{globalStats.pending.count}</div>
          <div className="stat-subvalue">{formatAmount(globalStats.pending.total)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">APPROUVÉ</div>
          <div className="stat-value">{globalStats.approved.count}</div>
          <div className="stat-subvalue">{formatAmount(globalStats.approved.total)}</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
          <div className="stat-label">💰 PAYÉ</div>
          <div className="stat-value">{globalStats.paid.count}</div>
          <div className="stat-subvalue">{formatAmount(globalStats.paid.total)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">REJETÉ</div>
          <div className="stat-value">{globalStats.rejected.count}</div>
          <div className="stat-subvalue">{formatAmount(globalStats.rejected.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL</div>
          <div className="stat-value">{expenses.length}</div>
          <div className="stat-subvalue">{formatAmount(globalStats.total)}</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="filter-tabs">
        <button type="button" className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
          📋 Toutes ({expenses.length})
        </button>
        <button type="button" className={`filter-tab ${filterStatus === 'pending' ? 'active' : ''}`} onClick={() => setFilterStatus('pending')}>
          ⏳ En attente ({globalStats.pending.count})
        </button>
        <button type="button" className={`filter-tab ${filterStatus === 'approved' ? 'active' : ''}`} onClick={() => setFilterStatus('approved')}>
          ✅ Approuvées ({globalStats.approved.count})
        </button>
        <button type="button" className={`filter-tab ${filterStatus === 'paid' ? 'active' : ''}`} onClick={() => setFilterStatus('paid')}>
          💰 Payées ({globalStats.paid.count})
        </button>
        <button type="button" className={`filter-tab ${filterStatus === 'rejected' ? 'active' : ''}`} onClick={() => setFilterStatus('rejected')}>
          ❌ Rejetées ({globalStats.rejected.count})
        </button>
      </div>

      {/* Liste par employé */}
      <div className="card-white">
        <h3 style={{ marginBottom: '1rem' }}>📁 Notes par employé</h3>

        {Object.keys(expensesByUser).length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Aucune note de frais</p>
            <p className="empty-state-subtitle">
              {filterStatus === 'all'
                ? 'Aucune note de frais n\'a encore été soumise'
                : `Aucune note de frais avec le statut "${filterStatus}"`
              }
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(expensesByUser)
              .sort(([_, a], [__, b]) => a.userName.localeCompare(b.userName))
              .map(([userId, data]) => (
                <UserExpensesAccordion
                  key={userId}
                  userName={data.userName}
                  userId={userId}
                  expenses={data.expenses}
                  onApprove={onApproveExpense}
                  onReject={onRejectExpense}
                  onDelete={onDeleteExpense}
                  onMarkAsPaid={onMarkAsPaid}
                  categories={categories}
                  formatDate={formatDate}
                  formatAmount={formatAmount}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
