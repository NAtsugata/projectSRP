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
import { detectDocument } from '../utils/documentDetector';
import { safeStorage } from '../utils/safeStorage';

// Modal de visualisation des justificatifs
const ReceiptsModal = ({ receipts, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!receipts || receipts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 10000
        }}
      >
        ×
      </button>

      <img
        src={receipts[currentIndex].url}
        alt={receipts[currentIndex].name || `Justificatif ${currentIndex + 1}`}
        style={{
          maxWidth: '90%',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {receipts.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '1rem',
            color: 'white'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="btn btn-secondary"
          >
            ← Précédent
          </button>
          <span style={{ lineHeight: '40px' }}>
            {currentIndex + 1} / {receipts.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.min(receipts.length - 1, prev + 1))}
            disabled={currentIndex === receipts.length - 1}
            className="btn btn-secondary"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default function ExpensesView({ expenses = [], onSubmitExpense, onDeleteExpense, profile, filters, onUpdateFilters }) {
  // Restaurer le state depuis localStorage si disponible (pour mobile après retour de caméra)
  // Utiliser localStorage au lieu de sessionStorage car certains navigateurs mobiles
  // vident sessionStorage quand l'onglet est suspendu pour ouvrir la caméra
  const [isCreating, setIsCreating] = useState(() => {
    const saved = safeStorage.getJSON('expense_form_isCreating', false);
    console.log('🔄 Restauration isCreating depuis localStorage:', saved);
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
    console.log('🔄 Restauration expense_form_data depuis localStorage:', saved !== defaultExpense ? 'OUI' : 'NON');
    if (saved && saved !== defaultExpense) {
      console.log('✅ Données restaurées:', {
        receipts: saved.receipts?.length || 0,
        date: saved.date,
        amount: saved.amount
      });
    }
    return saved;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false); // Flag pour éviter fermeture pendant traitement photo
  const [showReceipts, setShowReceipts] = useState(null); // État pour afficher le modal des justificatifs
  const [filterStatus, setFilterStatus] = useState('all'); // Filtre de statut

  // États pour la détection de documents
  const [documentDetectionResult, setDocumentDetectionResult] = useState(null);
  const [currentPhotoFile, setCurrentPhotoFile] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]); // File d'attente des photos à traiter

  // Sauvegarder dans localStorage à chaque changement (pour persister pendant photo mobile)
  useEffect(() => {
    if (isCreating) {
      safeStorage.setJSON('expense_form_isCreating', isCreating);
      safeStorage.setJSON('expense_form_data', newExpense);
      console.log('💾 Form state sauvegardé dans localStorage', {
        receipts: newExpense.receipts?.length || 0
      });
    }
  }, [isCreating, newExpense]);

  // Écouter les événements de visibilité de page (important pour mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Page redevenue visible - vérification localStorage...');
        const saved = safeStorage.getJSON('expense_form_isCreating', false);
        const savedData = safeStorage.getJSON('expense_form_data', null);

        if (saved) {
          console.log('🔄 Formulaire devrait être ouvert, forçage du state...');
          setIsCreating(true);

          if (savedData) {
            console.log('🔄 Restauration forcée des données:', {
              receipts: savedData.receipts?.length || 0
            });
            setNewExpense(savedData);
          }
        }
      } else {
        console.log('👁️ Page cachée/suspendue');
      }
    };

    const handlePageShow = (event) => {
      console.log('📄 pageshow event', { persisted: event.persisted });
      if (event.persisted) {
        // Page restaurée depuis le cache (back/forward)
        console.log('🔄 Page restaurée depuis cache, rechargement du state...');
        const saved = safeStorage.getJSON('expense_form_isCreating', false);
        if (saved) {
          setIsCreating(true);
          const savedData = safeStorage.getJSON('expense_form_data', null);
          if (savedData) {
            setNewExpense(savedData);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', () => console.log('🎯 Window focus'));
    window.addEventListener('blur', () => console.log('💤 Window blur'));

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


  // Calcul des statistiques directement depuis les données chargées
  // Cela garantit la cohérence avec la liste affichée
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
      console.log('🔓 Toutes les photos traitées, flag isProcessingPhoto désactivé');
      return;
    }

    const file = pendingPhotos[0];
    setCurrentPhotoFile(file);
    console.log('📸 Traitement de la photo:', file.name);

    try {
      // Détecter le document dans l'image
      console.log('🔍 Début détection de document...');
      const result = await detectDocument(file, {
        minArea: 0.1,
        autoTransform: true,
        drawContours: true
      });

      console.log('✅ Détection terminée:', result.detected ? 'Document détecté' : 'Aucun document');
      setDocumentDetectionResult(result);

    } catch (error) {
      console.error('❌ Erreur détection document:', error);
      // En cas d'erreur, utiliser l'image originale
      const reader = new FileReader();
      reader.onload = (e) => {
        const fallbackResult = {
          detected: false,
          original: e.target.result,
          preview: null,
          transformed: null,
          corners: null
        };
        setDocumentDetectionResult(fallbackResult);
      };
      reader.readAsDataURL(file);
    }
  }, [pendingPhotos]);

  // Traiter la photo suivante quand la file d'attente change
  useEffect(() => {
    if (pendingPhotos.length > 0 && !documentDetectionResult && !currentPhotoFile) {
      processNextPhoto();
    }
  }, [pendingPhotos, documentDetectionResult, currentPhotoFile, processNextPhoto]);

  // Gestion des photos
  const handleReceiptCapture = useCallback((event) => {
    console.log('💰 handleReceiptCapture appelé', event);
    console.log('💰 event.target:', event.target);
    console.log('💰 event.target.files:', event.target.files);

    // Activer le flag pour empêcher fermeture du formulaire
    setIsProcessingPhoto(true);
    console.log('🔒 Flag isProcessingPhoto activé');

    const files = Array.from(event.target.files);
    console.log('💰 Nombre de fichiers:', files.length);
    console.log('💰 Fichiers:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));

    if (files.length === 0) {
      console.warn('💰 Aucun fichier à traiter');
      setIsProcessingPhoto(false);
      console.log('🔓 Flag isProcessingPhoto désactivé (aucun fichier)');
      return;
    }

    console.log('💰 Ajout des fichiers à la file d\'attente pour détection...');
    setPendingPhotos(files);

  }, []);

  // Accepter le recadrage du document
  const handleAcceptCrop = useCallback((croppedImageUrl) => {
    console.log('✅ Utilisateur accepte le recadrage');
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

    // Passer à la photo suivante
    setDocumentDetectionResult(null);
    setCurrentPhotoFile(null);
    setPendingPhotos(prev => prev.slice(1));
  }, [currentPhotoFile]);

  // Utiliser l'image originale
  const handleUseOriginal = useCallback((originalImageUrl) => {
    console.log('📷 Utilisateur utilise l\'image originale');
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

    // Passer à la photo suivante
    setDocumentDetectionResult(null);
    setCurrentPhotoFile(null);
    setPendingPhotos(prev => prev.slice(1));
  }, [currentPhotoFile]);

  // Annuler et ne pas ajouter la photo
  const handleCancelCrop = useCallback(() => {
    console.log('❌ Utilisateur annule la photo');

    // Vider la file d'attente
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

      // Reset et nettoyage localStorage
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
      console.log('🗑️ LocalStorage nettoyé (soumission réussie)');
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

  const getStatusBadge = (expense) => {
    // Si payé, c'est prioritaire sur approved
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
        <div
          className="expense-form-card"
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
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

          <div
            className="form-group"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
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
                if (!isProcessingPhoto) {
                  setIsCreating(false);
                  setError(null);
                  localStorage.removeItem('expense_form_isCreating');
                  localStorage.removeItem('expense_form_data');
                  console.log('🗑️ LocalStorage nettoyé (annulé)');
                } else {
                  console.warn('⚠️ Annulation bloquée - traitement photo en cours');
                }
              }}
              disabled={isSubmitting || isProcessingPhoto}
            >
              {isProcessingPhoto ? 'Traitement...' : 'Annuler'}
            </button>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.25rem' }}>⏳ EN ATTENTE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>{stats.pending.count}</div>
          <div style={{ fontSize: '0.875rem', color: '#92400e' }}>{formatAmount(stats.pending.total)}</div>
        </div>
        <div style={{ background: '#d1fae5', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#065f46', marginBottom: '0.25rem' }}>✅ APPROUVÉ</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{stats.approved.count}</div>
          <div style={{ fontSize: '0.875rem', color: '#065f46' }}>{formatAmount(stats.approved.total)}</div>
        </div>
        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#1e3a8a', marginBottom: '0.25rem' }}>💰 PAYÉ</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#6366f1' }}>{stats.paid.count}</div>
          <div style={{ fontSize: '0.875rem', color: '#1e3a8a' }}>{formatAmount(stats.paid.total)}</div>
        </div>
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#991b1b', marginBottom: '0.25rem' }}>❌ REJETÉ</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>{stats.rejected.count}</div>
          <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>{formatAmount(stats.rejected.total)}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: filterStatus === 'all' ? '2px solid #3b82f6' : '1px solid #d1d5db',
            background: filterStatus === 'all' ? '#eff6ff' : 'white',
            color: filterStatus === 'all' ? '#1e40af' : '#6b7280',
            fontWeight: filterStatus === 'all' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          📋 Toutes ({expenses.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('pending')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: filterStatus === 'pending' ? '2px solid #f59e0b' : '1px solid #d1d5db',
            background: filterStatus === 'pending' ? '#fef3c7' : 'white',
            color: filterStatus === 'pending' ? '#92400e' : '#6b7280',
            fontWeight: filterStatus === 'pending' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          ⏳ En attente ({stats.pending.count})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('approved')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: filterStatus === 'approved' ? '2px solid #10b981' : '1px solid #d1d5db',
            background: filterStatus === 'approved' ? '#d1fae5' : 'white',
            color: filterStatus === 'approved' ? '#065f46' : '#6b7280',
            fontWeight: filterStatus === 'approved' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          ✅ Approuvées ({stats.approved.count})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('paid')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: filterStatus === 'paid' ? '2px solid #6366f1' : '1px solid #d1d5db',
            background: filterStatus === 'paid' ? '#eff6ff' : 'white',
            color: filterStatus === 'paid' ? '#1e3a8a' : '#6b7280',
            fontWeight: filterStatus === 'paid' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          💰 Payées ({stats.paid.count})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('rejected')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: filterStatus === 'rejected' ? '2px solid #ef4444' : '1px solid #d1d5db',
            background: filterStatus === 'rejected' ? '#fee2e2' : 'white',
            color: filterStatus === 'rejected' ? '#991b1b' : '#6b7280',
            fontWeight: filterStatus === 'rejected' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          ❌ Rejetées ({stats.rejected.count})
        </button>
      </div>

      {/* Liste des notes de frais */}
      <div className="card-white">
        <h3 style={{ marginBottom: '1rem' }}>📋 {filterStatus === 'all' ? 'Historique' : filterStatus === 'pending' ? 'En attente' : filterStatus === 'approved' ? 'Approuvées (à payer)' : filterStatus === 'paid' ? 'Payées' : 'Rejetées'}</h3>

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
                      <button
                        type="button"
                        onClick={() => setShowReceipts(expense.receipts)}
                        className="btn btn-sm btn-secondary"
                        style={{ width: '100%', marginBottom: '0.75rem' }}
                      >
                        <FileTextIcon /> Voir les {expense.receipts.length} justificatif{expense.receipts.length > 1 ? 's' : ''}
                      </button>
                    )}

                    {expense.admin_comment && (
                      <div className="admin-comment">
                        <strong>💬 Commentaire admin:</strong> {expense.admin_comment}
                      </div>
                    )}

                    {expense.is_paid && expense.paid_date && (
                      <div
                        style={{
                          background: '#eff6ff',
                          borderLeft: '3px solid #6366f1',
                          padding: '0.5rem 0.75rem',
                          marginBottom: '0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        <strong>💰 Payé le:</strong> {formatDate(expense.paid_date)}
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
