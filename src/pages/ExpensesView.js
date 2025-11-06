// src/pages/ExpensesView.js - NOTES DE FRAIS EMPLOYÉ
import React, { useState, useMemo, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CameraIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  XCircleIcon,
  CalendarIcon,
  CustomFileInput
} from '../components/SharedUI';

export default function ExpensesView({ expenses = [], onSubmitExpense, onDeleteExpense, profile }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'transport',
    amount: '',
    description: '',
    receipts: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Calculs statistiques
  const stats = useMemo(() => {
    const pending = expenses.filter(e => e.status === 'pending');
    const approved = expenses.filter(e => e.status === 'approved');
    const rejected = expenses.filter(e => e.status === 'rejected');

    return {
      pending: {
        count: pending.length,
        total: pending.reduce((sum, e) => sum + (e.amount || 0), 0)
      },
      approved: {
        count: approved.length,
        total: approved.reduce((sum, e) => sum + (e.amount || 0), 0)
      },
      rejected: {
        count: rejected.length,
        total: rejected.reduce((sum, e) => sum + (e.amount || 0), 0)
      },
      total: expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    };
  }, [expenses]);

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

  const getCategoryInfo = (value) => categories.find(c => c.value === value) || categories[categories.length - 1];

  // Gestion des photos
  const handleReceiptCapture = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Lire tous les fichiers en parallèle et mettre à jour le state une seule fois
    const readPromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve({
            id: Date.now() + Math.random(),
            url: ev.target.result,
            name: file.name,
            size: file.size
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises)
      .then(newReceipts => {
        setNewExpense(prev => ({
          ...prev,
          receipts: [...prev.receipts, ...newReceipts]
        }));
      })
      .catch(error => {
        console.error('Erreur lecture fichiers:', error);
        setError('Erreur lors de la lecture des fichiers');
      });
  }, []);

  const removeReceipt = (id) => {
    setNewExpense(prev => ({
      ...prev,
      receipts: prev.receipts.filter(r => r.id !== id)
    }));
  };

  // Soumission
  const handleSubmit = async () => {
    if (!newExpense.amount || !newExpense.description.trim()) {
      setError('Veuillez remplir le montant et la description.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitExpense({
        date: newExpense.date,
        category: newExpense.category,
        amount: parseFloat(newExpense.amount),
        description: newExpense.description.trim(),
        receipts: newExpense.receipts,
        userId: profile.id
      });

      // Reset
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        category: 'transport',
        amount: '',
        description: '',
        receipts: []
      });
      setIsCreating(false);
    } catch (err) {
      console.error('Erreur soumission note de frais:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { icon: <ClockIcon />, label: 'En attente', color: '#f59e0b', bg: '#fef3c7' };
      case 'approved':
        return { icon: <CheckCircleIcon />, label: 'Approuvé', color: '#10b981', bg: '#d1fae5' };
      case 'rejected':
        return { icon: <XCircleIcon />, label: 'Rejeté', color: '#ef4444', bg: '#fee2e2' };
      default:
        return { icon: <ClockIcon />, label: 'Inconnu', color: '#64748b', bg: '#f1f5f9' };
    }
  };

  return (
    <div>
      <style>{`
        .expense-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          border-radius: 0.75rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .stat-card.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .stat-card.warning {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        .stat-card.danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        .stat-label {
          font-size: 0.75rem;
          opacity: 0.9;
          margin-bottom: 0.25rem;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .stat-subvalue {
          font-size: 0.875rem;
          opacity: 0.8;
          margin-top: 0.25rem;
        }
        .expense-form-card {
          background: linear-gradient(145deg, #FFFAF0 0%, #FFF8DC 100%);
          border: 2px solid var(--copper-main, #CD7F32);
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 6px rgba(184, 115, 51, 0.15);
        }
        .receipt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .receipt-item {
          position: relative;
          aspect-ratio: 3/4;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 2px solid #e5e7eb;
          background: #f8f9fa;
        }
        .receipt-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .receipt-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0;
        }
        .expense-item {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 0.75rem;
          transition: all 0.2s;
        }
        .expense-item:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .expense-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .expense-category {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
        .expense-amount {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--copper-dark, #A0522D);
        }
        .expense-description {
          color: #4b5563;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        .expense-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #6b7280;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .admin-comment {
          background: #fef3c7;
          border-left: 3px solid #f59e0b;
          padding: 0.5rem 0.75rem;
          margin-top: 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }
        @media (max-width: 640px) {
          .expense-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .stat-value {
            font-size: 1.25rem;
          }
        }
      `}</style>

      <h2 className="view-title">💰 Mes Notes de Frais</h2>

      {/* Statistiques */}
      <div className="expense-stats-grid">
        <div className="stat-card warning">
          <div className="stat-label">EN ATTENTE</div>
          <div className="stat-value">{stats.pending.count}</div>
          <div className="stat-subvalue">{formatAmount(stats.pending.total)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">APPROUVÉ</div>
          <div className="stat-value">{stats.approved.count}</div>
          <div className="stat-subvalue">{formatAmount(stats.approved.total)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">REJETÉ</div>
          <div className="stat-value">{stats.rejected.count}</div>
          <div className="stat-subvalue">{formatAmount(stats.rejected.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL</div>
          <div className="stat-value">{expenses.length}</div>
          <div className="stat-subvalue">{formatAmount(stats.total)}</div>
        </div>
      </div>

      {/* Bouton Nouvelle Note */}
      {!isCreating && (
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => setIsCreating(true)}
          style={{ marginBottom: '1.5rem' }}
        >
          <PlusIcon /> Nouvelle Note de Frais
        </button>
      )}

      {/* Formulaire de création */}
      {isCreating && (
        <div className="expense-form-card">
          <h3 style={{ marginBottom: '1rem', color: 'var(--copper-dark, #A0522D)' }}>
            📝 Nouvelle Note de Frais
          </h3>

          <div className="form-group">
            <label htmlFor="expense-date">Date *</label>
            <input
              id="expense-date"
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
              className="form-control"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expense-category">Catégorie *</label>
            <select
              id="expense-category"
              value={newExpense.category}
              onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
              className="form-control"
              required
              disabled={isSubmitting}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="expense-amount">Montant (€) *</label>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              value={newExpense.amount}
              onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="Ex: 25.50"
              className="form-control"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="expense-description">Description *</label>
            <textarea
              id="expense-description"
              value={newExpense.description}
              onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ex: Repas client - Restaurant Le Gourmet"
              className="form-control"
              rows="3"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Justificatifs (photos)</label>
            <CustomFileInput
              onChange={handleReceiptCapture}
              accept="image/*"
              multiple={true}
              disabled={isSubmitting}
            >
              <CameraIcon /> Ajouter des photos
            </CustomFileInput>

            {newExpense.receipts.length > 0 && (
              <div className="receipt-grid">
                {newExpense.receipts.map(receipt => (
                  <div key={receipt.id} className="receipt-item">
                    <img src={receipt.url} alt={receipt.name} />
                    <button
                      type="button"
                      className="receipt-remove"
                      onClick={() => removeReceipt(receipt.id)}
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              <AlertTriangleIcon /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            >
              {isSubmitting ? '📤 Envoi...' : '✅ Soumettre'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsCreating(false);
                setError(null);
              }}
              disabled={isSubmitting}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des notes de frais */}
      <div className="card-white">
        <h3 style={{ marginBottom: '1rem' }}>📋 Historique</h3>

        {expenses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Aucune note de frais</p>
            <p className="empty-state-subtitle">Créez votre première note de frais ci-dessus</p>
          </div>
        ) : (
          <div>
            {expenses
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(expense => {
                const categoryInfo = getCategoryInfo(expense.category);
                const statusInfo = getStatusBadge(expense.status);

                return (
                  <div key={expense.id} className="expense-item">
                    <div className="expense-header">
                      <div>
                        <span
                          className="expense-category"
                          style={{
                            backgroundColor: `${categoryInfo.color}20`,
                            color: categoryInfo.color
                          }}
                        >
                          {categoryInfo.label}
                        </span>
                      </div>
                      <div className="expense-amount">{formatAmount(expense.amount)}</div>
                    </div>

                    <div className="expense-description">{expense.description}</div>

                    {expense.receipts && expense.receipts.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        📎 {expense.receipts.length} justificatif{expense.receipts.length > 1 ? 's' : ''}
                      </div>
                    )}

                    {expense.admin_comment && (
                      <div className="admin-comment">
                        <strong>💬 Commentaire admin:</strong> {expense.admin_comment}
                      </div>
                    )}

                    <div className="expense-footer">
                      <div>
                        <CalendarIcon style={{ display: 'inline', width: '12px', height: '12px', marginRight: '4px' }} />
                        {formatDate(expense.date)}
                      </div>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color
                        }}
                      >
                        {statusInfo.icon}
                        {statusInfo.label}
                      </span>
                    </div>

                    {expense.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onDeleteExpense(expense)}
                        style={{ marginTop: '0.5rem', width: '100%' }}
                      >
                        <TrashIcon /> Supprimer
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
