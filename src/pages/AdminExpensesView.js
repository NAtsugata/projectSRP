// src/pages/AdminExpensesView.js - GESTION ADMIN NOTES DE FRAIS
import React, { useState, useMemo, useEffect } from 'react';
import jsPDF from 'jspdf';
import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ChevronDownIcon,
  CalendarIcon,
  FileTextIcon,
  DownloadIcon
} from '../components/SharedUI';
import * as expenseStatsService from '../services/expenseStatsService';

import { createPortal } from 'react-dom';

// ... imports ...

// Modal de visualisation des justificatifs
const ReceiptsModal = ({ receipts, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!receipts || receipts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 99999,
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
          zIndex: 100000
        }}
      >
        ×
      </button>

      <img
        src={receipts[currentIndex].url}
        alt={receipts[currentIndex].name}
        style={{
          maxWidth: '90%',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: '8px'
        }}
        onClick={(e) => e.stopPropagation()}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = 'https://via.placeholder.com/400x300?text=Image+introuvable';
          alert('Impossible de charger l\'image. Le lien est peut-être expiré ou inaccessible.');
        }}
      />

      <div style={{ color: 'white', marginTop: '1rem', textAlign: 'center' }}>
        <p>{receipts[currentIndex].name}</p>
        <a
          href={receipts[currentIndex].url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#6366f1', textDecoration: 'underline', fontSize: '0.9rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          Ouvrir l'original dans un nouvel onglet
        </a>
      </div>

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
            className="btn"
            style={{
              color: 'white',
              borderColor: 'white',
              background: 'rgba(255,255,255,0.1)',
              opacity: currentIndex === 0 ? 0.5 : 1
            }}
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
            className="btn"
            style={{
              color: 'white',
              borderColor: 'white',
              background: 'rgba(255,255,255,0.1)',
              opacity: currentIndex === receipts.length - 1 ? 0.5 : 1
            }}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

// Accordion pour chaque employé
const UserExpensesAccordion = ({ userName, userId, expenses, onApprove, onReject, onDelete, onMarkAsPaid, categories, formatDate, formatAmount }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showReceipts, setShowReceipts] = useState(null);
  const [commentInput, setCommentInput] = useState({});

  const getCategoryInfo = (value) => categories.find(c => c.value === value) || categories[categories.length - 1];

  const userStats = useMemo(() => {
    const pending = expenses.filter(e => e.status === 'pending');
    const approved = expenses.filter(e => e.status === 'approved' && !e.is_paid);
    const paid = expenses.filter(e => e.is_paid);
    const rejected = expenses.filter(e => e.status === 'rejected');

    return {
      pending: pending.reduce((sum, e) => sum + (e.amount || 0), 0),
      approved: approved.reduce((sum, e) => sum + (e.amount || 0), 0),
      paid: paid.reduce((sum, e) => sum + (e.amount || 0), 0),
      rejected: rejected.reduce((sum, e) => sum + (e.amount || 0), 0),
      total: expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    };
  }, [expenses]);

  const handleApprove = async (expenseId, comment) => {
    await onApprove(expenseId, comment);
    setCommentInput(prev => ({ ...prev, [expenseId]: '' }));
  };

  const handleReject = async (expenseId, comment) => {
    if (!comment.trim()) {
      alert('Veuillez indiquer une raison pour le rejet.');
      return;
    }
    await onReject(expenseId, comment);
    setCommentInput(prev => ({ ...prev, [expenseId]: '' }));
  };

  const handleDownload = async (expense) => {
    try {
      const categoryInfo = getCategoryInfo(expense.category);

      // Créer un nouveau document PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      // En-tête
      pdf.setFontSize(20);
      pdf.setFont(undefined, 'bold');
      pdf.text('NOTE DE FRAIS', margin, yPos);
      yPos += 15;

      // Ligne de séparation
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Informations principales
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Employé:', margin, yPos);
      pdf.setFont(undefined, 'normal');
      pdf.text(userName, margin + 40, yPos);
      yPos += 8;

      pdf.setFont(undefined, 'bold');
      pdf.text('Date:', margin, yPos);
      pdf.setFont(undefined, 'normal');
      pdf.text(formatDate(expense.date), margin + 40, yPos);
      yPos += 8;

      pdf.setFont(undefined, 'bold');
      pdf.text('Catégorie:', margin, yPos);
      pdf.setFont(undefined, 'normal');
      pdf.text(categoryInfo.label, margin + 40, yPos);
      yPos += 8;

      pdf.setFont(undefined, 'bold');
      pdf.text('Montant:', margin, yPos);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(14);
      pdf.text(formatAmount(expense.amount), margin + 40, yPos);
      yPos += 8;

      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Statut:', margin, yPos);
      pdf.setFont(undefined, 'normal');
      const statusText = expense.status === 'pending' ? 'En attente' : expense.status === 'approved' ? 'Approuvé' : 'Rejeté';
      pdf.text(statusText, margin + 40, yPos);
      yPos += 12;

      // Description
      pdf.setFont(undefined, 'bold');
      pdf.text('Description:', margin, yPos);
      yPos += 8;
      pdf.setFont(undefined, 'normal');
      const descLines = pdf.splitTextToSize(expense.description, pageWidth - 2 * margin);
      pdf.text(descLines, margin, yPos);
      yPos += (descLines.length * 6) + 8;

      // Commentaire admin
      if (expense.admin_comment) {
        pdf.setFont(undefined, 'bold');
        pdf.text('Commentaire administrateur:', margin, yPos);
        yPos += 8;
        pdf.setFont(undefined, 'normal');
        const commentLines = pdf.splitTextToSize(expense.admin_comment, pageWidth - 2 * margin);
        pdf.text(commentLines, margin, yPos);
        yPos += (commentLines.length * 6) + 8;
      }

      // Justificatifs
      if (expense.receipts && expense.receipts.length > 0) {
        yPos += 5;
        pdf.setFont(undefined, 'bold');
        pdf.text(`Justificatifs (${expense.receipts.length}):`, margin, yPos);
        yPos += 10;

        // Charger et ajouter chaque image
        for (let i = 0; i < expense.receipts.length; i++) {
          const receipt = expense.receipts[i];

          try {
            // Vérifier si on a besoin d'une nouvelle page
            if (yPos + 100 > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }

            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(10);
            pdf.text(`${i + 1}. ${receipt.name}`, margin, yPos);
            yPos += 8;

            // Charger l'image avec un timeout et gestion d'erreur
            const response = await fetch(receipt.url, { cache: 'no-cache' });
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();

            // Convertir en base64
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // Calculer les dimensions pour l'image
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = base64;
            });

            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = (img.height * imgWidth) / img.width;
            const maxImgHeight = 120;
            const finalHeight = Math.min(imgHeight, maxImgHeight);
            const finalWidth = (img.width * finalHeight) / img.height;

            // Vérifier à nouveau si on a besoin d'une nouvelle page après calcul de la hauteur
            if (yPos + finalHeight > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }

            // Ajouter l'image au PDF
            pdf.addImage(base64, 'JPEG', margin, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 10;

          } catch (error) {
            console.error(`Erreur lors du chargement de l'image ${receipt.name}:`, error);

            // Fallback: Ajouter un lien vers l'image si le chargement échoue (CORS, etc.)
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 255);
            pdf.textWithLink(`[Lien vers l'image: ${receipt.name}]`, margin, yPos, { url: receipt.url });
            pdf.setTextColor(0, 0, 0);
            yPos += 8;

            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`(Image non intégrée: ${error.message})`, margin, yPos);
            pdf.setTextColor(0, 0, 0);
            yPos += 10;
          }
        }
      }

      // Télécharger le PDF
      pdf.save(`note-frais-${userName.replace(/\s+/g, '-')}-${expense.date}.pdf`);

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  return (
    <div className="user-accordion">
      <button type="button" className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="accordion-title">
          <UserIcon />
          <span>{userName}</span>
          <span className="document-count">{expenses.length} note{expenses.length > 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--copper-dark, #A0522D)' }}>
            {formatAmount(userStats.total)}
          </span>
          <ChevronDownIcon className={`accordion-chevron ${isOpen ? 'open' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="accordion-content">
          {/* Stats par utilisateur */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '0.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>En attente</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f59e0b' }}>{formatAmount(userStats.pending)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Approuvé</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981' }}>{formatAmount(userStats.approved)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Payé</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#6366f1' }}>{formatAmount(userStats.paid)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>Rejeté</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444' }}>{formatAmount(userStats.rejected)}</div>
            </div>
          </div>

          {/* Liste des notes de frais */}
          {expenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(expense => {
              const categoryInfo = getCategoryInfo(expense.category);
              const isPending = expense.status === 'pending';

              return (
                <div
                  key={expense.id}
                  style={{
                    background: '#1e293b', // Dark card background
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Header: Category & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'white',
                      textTransform: 'capitalize'
                    }}>
                      {categoryInfo.label.replace(/^[^\s]+\s/, '')}
                    </h3>

                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          expense.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                            expense.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' :
                              expense.is_paid ? 'rgba(99, 102, 241, 0.2)' :
                                'rgba(245, 158, 11, 0.2)',
                        color:
                          expense.status === 'approved' ? '#34d399' :
                            expense.status === 'rejected' ? '#f87171' :
                              expense.is_paid ? '#818cf8' :
                                '#fbbf24',
                        border: '1px solid currentColor'
                      }}
                    >
                      {expense.is_paid ? 'Payé' :
                        expense.status === 'approved' ? 'Approuvé' :
                          expense.status === 'rejected' ? 'Rejeté' :
                            'En attente'}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{
                    color: '#94a3b8',
                    fontSize: '0.95rem',
                    marginBottom: '1rem',
                    lineHeight: '1.5'
                  }}>
                    {expense.description}
                  </div>

                  {/* Info Row: Date & Amount */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CalendarIcon style={{ width: '16px', height: '16px', opacity: 0.7 }} />
                      <span>{formatDate(expense.date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontWeight: 700,
                        color: 'white',
                        fontSize: '1rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {formatAmount(expense.amount)}
                      </span>
                    </div>
                    {/* Justificatifs Indicator */}
                    {expense.receipts && expense.receipts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowReceipts(expense.receipts)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.85rem',
                          padding: 0
                        }}
                      >
                        <FileTextIcon style={{ width: '14px', height: '14px' }} />
                        {expense.receipts.length} PJ
                      </button>
                    )}
                  </div>

                  {/* Admin Comment if exists */}
                  {expense.admin_comment && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderLeft: '3px solid #f59e0b',
                      borderRadius: '0 4px 4px 0',
                      color: '#fbbf24',
                      fontSize: '0.85rem'
                    }}>
                      <strong style={{ marginRight: '0.5rem' }}>Note Admin:</strong>
                      {expense.admin_comment}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div style={{
                    marginTop: '1.5rem',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    alignItems: 'center'
                  }}>

                    {/* Pending Actions */}
                    {isPending && (
                      <>
                        <div style={{ flex: 1, marginRight: 'auto' }}>
                          <textarea
                            value={commentInput[expense.id] || ''}
                            onChange={(e) => setCommentInput(prev => ({ ...prev, [expense.id]: e.target.value }))}
                            placeholder="Commentaire..."
                            style={{
                              width: '100%',
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '0.375rem',
                              color: 'white',
                              padding: '0.5rem',
                              fontSize: '0.85rem',
                              minHeight: '38px',
                              resize: 'none'
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleApprove(expense.id, commentInput[expense.id])}
                          className="btn"
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <CheckCircleIcon style={{ width: '18px' }} /> Approuver
                        </button>
                        <button
                          onClick={() => handleReject(expense.id, commentInput[expense.id])}
                          className="btn"
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            fontWeight: 600
                          }}
                        >
                          Rejeter
                        </button>
                      </>
                    )}

                    {/* Approved Actions (Mark as Paid) */}
                    {expense.status === 'approved' && !expense.is_paid && onMarkAsPaid && (
                      <button
                        onClick={() => onMarkAsPaid(expense.id)}
                        className="btn"
                        style={{
                          background: '#6366f1', // Indigo/Purple
                          color: 'white',
                          border: 'none',
                          padding: '0.6rem 1.25rem',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
                          transition: 'transform 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        Marquer comme payé
                      </button>
                    )}

                    {/* Download Button (Icon only or small) */}
                    <button
                      onClick={() => handleDownload(expense)}
                      title="Télécharger PDF"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                      <DownloadIcon style={{ width: '20px', height: '20px' }} />
                    </button>

                    {/* Delete Button (Red Square) */}
                    <button
                      onClick={() => onDelete(expense)}
                      title="Supprimer"
                      style={{
                        background: '#ef4444',
                        border: 'none',
                        color: 'white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🗑️</span>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {showReceipts && (
        <ReceiptsModal
          receipts={showReceipts}
          onClose={() => setShowReceipts(null)}
        />
      )}
    </div>
  );
};

export default function AdminExpensesView({ users = [], expenses = [], onApproveExpense, onRejectExpense, onDeleteExpense, onMarkAsPaid, filters, onUpdateFilters }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [globalStats, setGlobalStats] = useState({
    pending: { count: 0, total: 0 },
    approved: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
    total: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Catégories de frais (même que ExpensesView)
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

  // Charger les statistiques globales (avec vues matérialisées ou fallback)
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const { data, error } = await expenseStatsService.getGlobalStats();

        if (error) {
          console.error('Erreur lors du chargement des stats:', error);
          // Fallback: calculer côté client si le service échoue
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
        console.error('Erreur inattendue:', err);
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
        .user-accordion {
          background: white;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: visible;
        }
        .accordion-header {
          width: 100%;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          background-color: white;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          border-radius: 0.5rem 0.5rem 0 0;
        }
        .accordion-header:hover {
          background-color: #f9fafb;
        }
        .accordion-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          font-size: 1rem;
          color: #1f2937;
        }
        .document-count {
          font-size: 0.875rem;
          color: #6c757d;
          font-weight: normal;
          background-color: #e9ecef;
          padding: 2px 8px;
          border-radius: 12px;
        }
        .accordion-chevron {
          transition: transform 0.2s ease;
          color: #6c757d;
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
          border: 2px solid #e5e7eb;
          background: white;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .filter-tab.active {
          background: var(--copper-main, #CD7F32);
          color: white;
          border-color: var(--copper-main, #CD7F32);
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
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          📋 Toutes ({expenses.length})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          ⏳ En attente ({globalStats.pending.count})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setFilterStatus('approved')}
        >
          ✅ Approuvées ({globalStats.approved.count})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'paid' ? 'active' : ''}`}
          onClick={() => setFilterStatus('paid')}
        >
          💰 Payées ({globalStats.paid.count})
        </button>
        <button
          type="button"
          className={`filter-tab ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
        >
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
    </div >
  );
}
