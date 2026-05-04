// src/pages/ExpensesView.js - NOTES DE FRAIS EMPLOYÉ
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CameraIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  XCircleIcon,
  CalendarIcon,
  CustomFileInput,
  FileTextIcon
} from '../components/SharedUI';
import DocumentCropPreview from '../components/DocumentCropPreview';
import { ReceiptsModal } from '../components/expenses';
import { detectDocument } from '../utils/jscanifyDetector';
import { safeStorage } from '../utils/safeStorage';
import logger from '../utils/logger';
import expenseService from '../services/expenseService';
import '../components/expenses/ExpensesStyles.css';

export default function ExpensesView({ expenses = [], onSubmitExpense, onDeleteExpense, profile, filters, onUpdateFilters }) {
  const [isCreating, setIsCreating] = useState(() => {
    const saved = safeStorage.getJSON('expense_form_isCreating', false);
    logger.log('Restauration isCreating depuis localStorage:', saved);
    return saved;
  });
  const [newExpense, setNewExpense] = useState(() => {
    const defaultExpense = {
      date: new Date().toISOString().split('T')[0],
      category: 'transport',
      amount: '',
      description: '',
      receipts: []
    };
    const saved = safeStorage.getJSON('expense_form_data', defaultExpense);
    if (saved && saved !== defaultExpense) {
      logger.log('Données restaurées:', { receipts: saved.receipts?.length || 0 });
    }
    return saved;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showReceipts, setShowReceipts] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // États pour la détection de documents
  const [documentDetectionResult, setDocumentDetectionResult] = useState(null);
  const [currentPhotoFile, setCurrentPhotoFile] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (isCreating) {
      safeStorage.setJSON('expense_form_isCreating', isCreating);
      safeStorage.setJSON('expense_form_data', newExpense);
    }
  }, [isCreating, newExpense]);

  // Écouter les événements de visibilité de page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const saved = safeStorage.getJSON('expense_form_isCreating', false);
        const savedData = safeStorage.getJSON('expense_form_data', null);
        if (saved) {
          setIsCreating(true);
          if (savedData) setNewExpense(savedData);
        }
      }
    };

    const handlePageShow = (event) => {
      if (event.persisted) {
        const saved = safeStorage.getJSON('expense_form_isCreating', false);
        if (saved) {
          setIsCreating(true);
          const savedData = safeStorage.getJSON('expense_form_data', null);
          if (savedData) setNewExpense(savedData);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

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

  const getCategoryInfo = (value) => categories.find(c => c.value === value) || categories[categories.length - 1];

  // Calcul des statistiques
  const stats = useMemo(() => {
    const initialStats = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
      total: 0
    };

    return expenses.reduce((acc, expense) => {
      const amount = Number(expense.amount) || 0;
      acc.total += amount;

      if (expense.is_paid) {
        acc.paid.count++;
        acc.paid.total += amount;
      } else {
        const status = expense.status || 'pending';
        if (acc[status]) {
          acc[status].count++;
          acc[status].total += amount;
        }
      }
      return acc;
    }, initialStats);
  }, [expenses]);

  // Filtrage des expenses
  const filteredExpenses = useMemo(() => {
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
    return filtered;
  }, [expenses, filterStatus]);

  // Traiter la prochaine photo dans la file d'attente
  const processNextPhoto = useCallback(async () => {
    if (pendingPhotos.length === 0) {
      setIsProcessingPhoto(false);
      return;
    }

    const file = pendingPhotos[0];
    setCurrentPhotoFile(file);

    try {
      // Détecter le document avec jscanify + OpenCV.js
      const result = await detectDocument(file, {
        outputWidth: 595,
        outputHeight: 842
      });

      setDocumentDetectionResult({
        detected: result.detected,
        original: result.original,
        preview: result.preview || result.original,
        transformed: result.transformed || null,
        corners: result.corners || null,
        confidence: result.confidence || 0
      });
    } catch (error) {
      logger.error('Erreur détection document:', error);
      // Fallback: lire l'image originale
      const reader = new FileReader();
      reader.onload = (e) => {
        setDocumentDetectionResult({
          detected: false,
          original: e.target.result,
          preview: null,
          transformed: null,
          corners: null
        });
      };
      reader.readAsDataURL(file);
    }
  }, [pendingPhotos]);

  // Traiter la photo suivante
  useEffect(() => {
    if (pendingPhotos.length > 0 && !documentDetectionResult && !currentPhotoFile) {
      processNextPhoto();
    }
  }, [pendingPhotos, documentDetectionResult, currentPhotoFile, processNextPhoto]);

  // Gestion des photos
  const handleReceiptCapture = useCallback((event) => {
    setIsProcessingPhoto(true);
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      setIsProcessingPhoto(false);
      return;
    }
    setPendingPhotos(files);
  }, []);

  // Accepter le recadrage
  const handleAcceptCrop = useCallback((croppedImageUrl) => {
    const receipt = {
      id: Date.now() + Math.random(),
      url: croppedImageUrl,
      name: currentPhotoFile.name,
      size: currentPhotoFile.size
    };

    setNewExpense(prev => ({
      ...prev,
      receipts: [...prev.receipts, receipt]
    }));

    setDocumentDetectionResult(null);
    setCurrentPhotoFile(null);
    setPendingPhotos(prev => prev.slice(1));
  }, [currentPhotoFile]);

  // Utiliser l'image originale
  const handleUseOriginal = useCallback((originalImageUrl) => {
    const receipt = {
      id: Date.now() + Math.random(),
      url: originalImageUrl,
      name: currentPhotoFile.name,
      size: currentPhotoFile.size
    };

    setNewExpense(prev => ({
      ...prev,
      receipts: [...prev.receipts, receipt]
    }));

    setDocumentDetectionResult(null);
    setCurrentPhotoFile(null);
    setPendingPhotos(prev => prev.slice(1));
  }, [currentPhotoFile]);

  // Annuler
  const handleCancelCrop = useCallback(() => {
    setDocumentDetectionResult(null);
    setCurrentPhotoFile(null);
    setPendingPhotos([]);
    setIsProcessingPhoto(false);
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

      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        category: 'transport',
        amount: '',
        description: '',
        receipts: []
      });
      setIsCreating(false);
      localStorage.removeItem('expense_form_isCreating');
      localStorage.removeItem('expense_form_data');
    } catch (err) {
      logger.error('Erreur soumission note de frais:', err);
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

  const getStatusBadge = (expense) => {
    if (expense.is_paid) {
      return { icon: '💰', label: 'Payé', color: '#6366f1', bg: '#eff6ff' };
    }
    switch (expense.status) {
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

  const renderFilterButton = (status, label, emoji, count, colors) => (
    <button
      type="button"
      onClick={() => setFilterStatus(status)}
      className={`expense-filter-btn ${filterStatus === status ? 'active' : ''}`}
      style={{
        border: filterStatus === status ? `2px solid ${colors.border}` : '1px solid #d1d5db',
        background: filterStatus === status ? colors.bg : 'white',
        color: filterStatus === status ? colors.text : '#6b7280'
      }}
    >
      {emoji} {label} ({count})
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="view-title" style={{ marginBottom: 0 }}>💰 Mes Notes de Frais</h2>
        <select
          className="form-control"
          onChange={(e) => handlePeriodChange(e.target.value)}
          defaultValue="3m"
          style={{ padding: '0.5rem', borderRadius: '0.5rem', width: 'auto', minWidth: '120px' }}
        >
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="all">Tout</option>
        </select>
      </div>

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
        <div className="expense-form-card" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
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

          <div className="form-group" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <label>Justificatifs (photos)</label>
            <CustomFileInput onChange={handleReceiptCapture} accept="image/*" multiple={true} disabled={isSubmitting}>
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
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 1 }}>
              {isSubmitting ? '📤 Envoi...' : '✅ Soumettre'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!isProcessingPhoto) {
                  setIsCreating(false);
                  setError(null);
                  localStorage.removeItem('expense_form_isCreating');
                  localStorage.removeItem('expense_form_data');
                }
              }}
              disabled={isSubmitting || isProcessingPhoto}
            >
              {isProcessingPhoto ? 'Traitement...' : 'Annuler'}
            </button>
          </div>
        </div>
      )}

      {/* Statistiques mini */}
      <div className="stats-mini-grid">
        <div className="stats-mini-card" style={{ background: '#fef3c7' }}>
          <div className="label" style={{ color: '#92400e' }}>⏳ EN ATTENTE</div>
          <div className="value" style={{ color: '#f59e0b' }}>{stats.pending.count}</div>
          <div className="subvalue" style={{ color: '#92400e' }}>{formatAmount(stats.pending.total)}</div>
        </div>
        <div className="stats-mini-card" style={{ background: '#d1fae5' }}>
          <div className="label" style={{ color: '#065f46' }}>✅ APPROUVÉ</div>
          <div className="value" style={{ color: '#10b981' }}>{stats.approved.count}</div>
          <div className="subvalue" style={{ color: '#065f46' }}>{formatAmount(stats.approved.total)}</div>
        </div>
        <div className="stats-mini-card" style={{ background: '#eff6ff' }}>
          <div className="label" style={{ color: '#1e3a8a' }}>💰 PAYÉ</div>
          <div className="value" style={{ color: '#6366f1' }}>{stats.paid.count}</div>
          <div className="subvalue" style={{ color: '#1e3a8a' }}>{formatAmount(stats.paid.total)}</div>
        </div>
        <div className="stats-mini-card" style={{ background: '#fee2e2' }}>
          <div className="label" style={{ color: '#991b1b' }}>❌ REJETÉ</div>
          <div className="value" style={{ color: '#ef4444' }}>{stats.rejected.count}</div>
          <div className="subvalue" style={{ color: '#991b1b' }}>{formatAmount(stats.rejected.total)}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {renderFilterButton('all', 'Toutes', '📋', expenses.length, { border: '#3b82f6', bg: '#eff6ff', text: '#1e40af' })}
        {renderFilterButton('pending', 'En attente', '⏳', stats.pending.count, { border: '#f59e0b', bg: '#fef3c7', text: '#92400e' })}
        {renderFilterButton('approved', 'Approuvées', '✅', stats.approved.count, { border: '#10b981', bg: '#d1fae5', text: '#065f46' })}
        {renderFilterButton('paid', 'Payées', '💰', stats.paid.count, { border: '#6366f1', bg: '#eff6ff', text: '#1e3a8a' })}
        {renderFilterButton('rejected', 'Rejetées', '❌', stats.rejected.count, { border: '#ef4444', bg: '#fee2e2', text: '#991b1b' })}
      </div>

      {/* Liste des notes de frais */}
      <div className="card-white">
        <h3 style={{ marginBottom: '1rem' }}>
          📋 {filterStatus === 'all' ? 'Historique' : filterStatus === 'pending' ? 'En attente' : filterStatus === 'approved' ? 'Approuvées (à payer)' : filterStatus === 'paid' ? 'Payées' : 'Rejetées'}
        </h3>

        {filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Aucune note de frais</p>
            <p className="empty-state-subtitle">
              {filterStatus === 'all' ? 'Créez votre première note de frais ci-dessus' : `Aucune note de frais ${filterStatus === 'pending' ? 'en attente' : filterStatus === 'approved' ? 'approuvée' : filterStatus === 'paid' ? 'payée' : 'rejetée'}`}
            </p>
          </div>
        ) : (
          <div>
            {filteredExpenses
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(expense => {
                const categoryInfo = getCategoryInfo(expense.category);
                const statusInfo = getStatusBadge(expense);

                return (
                  <div key={expense.id} className="expense-item">
                    <div className="expense-header">
                      <div>
                        <span
                          className="expense-category"
                          style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}
                        >
                          {categoryInfo.label}
                        </span>
                      </div>
                      <div className="expense-amount">{formatAmount(expense.amount)}</div>
                    </div>

                    <div className="expense-description">{expense.description}</div>

                    {(expense.receipts_count > 0) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const { data } = await expenseService.getExpenseReceipts(expense.id);
                          setShowReceipts(data);
                        }}
                        className="btn btn-sm btn-secondary"
                        style={{ width: '100%', marginBottom: '0.75rem' }}
                      >
                        <FileTextIcon /> Voir les {expense.receipts_count} justificatif{expense.receipts_count > 1 ? 's' : ''}
                      </button>
                    )}

                    {expense.admin_comment && (
                      <div className="admin-comment">
                        <strong>💬 Commentaire admin:</strong> {expense.admin_comment}
                      </div>
                    )}

                    {expense.is_paid && expense.paid_date && (
                      <div className="paid-info">
                        <strong>💰 Payé le:</strong> {formatDate(expense.paid_date)}
                      </div>
                    )}

                    <div className="expense-footer">
                      <div>
                        <CalendarIcon style={{ display: 'inline', width: '12px', height: '12px', marginRight: '4px' }} />
                        {formatDate(expense.date)}
                      </div>
                      <span className="status-badge" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </span>
                    </div>

                    {expense.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onDeleteExpense(expense.id)}
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

      {/* Document Crop Preview Modal */}
      {documentDetectionResult && (
        <DocumentCropPreview
          detectionResult={documentDetectionResult}
          onAccept={handleAcceptCrop}
          onUseOriginal={handleUseOriginal}
          onCancel={handleCancelCrop}
          isProcessing={false}
        />
      )}

      {/* Receipts Modal */}
      {showReceipts && (
        <ReceiptsModal
          receipts={showReceipts}
          onClose={() => setShowReceipts(null)}
        />
      )}
    </div>
  );
}
