// src/components/expenses/UserExpensesAccordion.js
// Accordion pour afficher les notes de frais d'un employé (vue admin)

import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import logger from '../../utils/logger';
import {
  CheckCircleIcon,
  UserIcon,
  ChevronDownIcon,
  CalendarIcon,
  FileTextIcon,
  DownloadIcon
} from '../SharedUI';
import ReceiptsModal from './ReceiptsModal';

const UserExpensesAccordion = ({
  userName,
  userId,
  expenses,
  onApprove,
  onReject,
  onDelete,
  onMarkAsPaid,
  categories,
  formatDate,
  formatAmount
}) => {
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

      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Informations
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

        for (let i = 0; i < expense.receipts.length; i++) {
          const receipt = expense.receipts[i];

          try {
            if (yPos + 100 > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }

            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(10);
            pdf.text(`${i + 1}. ${receipt.name}`, margin, yPos);
            yPos += 8;

            const response = await fetch(receipt.url, { cache: 'no-cache' });
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();

            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

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

            if (yPos + finalHeight > pageHeight - margin) {
              pdf.addPage();
              yPos = margin;
            }

            pdf.addImage(base64, 'JPEG', margin, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 10;

          } catch (error) {
            logger.error(`Erreur lors du chargement de l'image ${receipt.name}:`, error);
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

      pdf.save(`note-frais-${userName.replace(/\s+/g, '-')}-${expense.date}.pdf`);

    } catch (error) {
      logger.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    }
  };

  const getStatusStyle = (expense) => {
    const base = {
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      border: '1px solid currentColor'
    };

    if (expense.is_paid) {
      return { ...base, backgroundColor: 'rgba(99, 102, 241, 0.3)', color: '#6366f1' };
    }
    if (expense.status === 'approved') {
      return { ...base, backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#059669' };
    }
    if (expense.status === 'rejected') {
      return { ...base, backgroundColor: 'rgba(239, 68, 68, 0.3)', color: '#dc2626' };
    }
    return { ...base, backgroundColor: 'rgba(245, 158, 11, 0.3)', color: '#d97706' };
  };

  const getStatusLabel = (expense) => {
    if (expense.is_paid) return 'Payé';
    if (expense.status === 'approved') return 'Approuvé';
    if (expense.status === 'rejected') return 'Rejeté';
    return 'En attente';
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
          <div className="user-stats-grid">
            <div className="user-stat-item">
              <div className="user-stat-label">En attente</div>
              <div className="user-stat-value pending">{formatAmount(userStats.pending)}</div>
            </div>
            <div className="user-stat-item">
              <div className="user-stat-label">Approuvé</div>
              <div className="user-stat-value approved">{formatAmount(userStats.approved)}</div>
            </div>
            <div className="user-stat-item">
              <div className="user-stat-label">Payé</div>
              <div className="user-stat-value paid">{formatAmount(userStats.paid)}</div>
            </div>
            <div className="user-stat-item">
              <div className="user-stat-label">Rejeté</div>
              <div className="user-stat-value rejected">{formatAmount(userStats.rejected)}</div>
            </div>
          </div>

          {/* Liste des notes de frais */}
          {expenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(expense => {
              const categoryInfo = getCategoryInfo(expense.category);
              const isPending = expense.status === 'pending';

              return (
                <div key={expense.id} className="admin-expense-card">
                  {/* Header */}
                  <div className="admin-expense-header">
                    <h3 className="admin-expense-title">
                      {categoryInfo.label.replace(/^[^\s]+\s/, '')}
                    </h3>
                    <span style={getStatusStyle(expense)}>
                      {getStatusLabel(expense)}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="admin-expense-description">{expense.description}</div>

                  {/* Info Row */}
                  <div className="admin-expense-info">
                    <div className="admin-expense-date">
                      <CalendarIcon style={{ width: '16px', height: '16px', opacity: 0.7 }} />
                      <span>{formatDate(expense.date)}</span>
                    </div>
                    <div className="admin-expense-amount">{formatAmount(expense.amount)}</div>
                    {expense.receipts && expense.receipts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowReceipts(expense.receipts)}
                        className="admin-expense-receipts-btn"
                      >
                        <FileTextIcon style={{ width: '14px', height: '14px' }} />
                        {expense.receipts.length} PJ
                      </button>
                    )}
                  </div>

                  {/* Admin Comment */}
                  {expense.admin_comment && (
                    <div className="admin-expense-comment">
                      <strong>Note Admin:</strong> {expense.admin_comment}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="admin-expense-actions">
                    {isPending && (
                      <>
                        <div className="admin-expense-comment-input">
                          <textarea
                            value={commentInput[expense.id] || ''}
                            onChange={(e) => setCommentInput(prev => ({ ...prev, [expense.id]: e.target.value }))}
                            placeholder="Commentaire..."
                          />
                        </div>
                        <button onClick={() => handleApprove(expense.id, commentInput[expense.id])} className="btn-approve">
                          <CheckCircleIcon style={{ width: '18px' }} /> Approuver
                        </button>
                        <button onClick={() => handleReject(expense.id, commentInput[expense.id])} className="btn-reject">
                          Rejeter
                        </button>
                      </>
                    )}

                    {expense.status === 'approved' && !expense.is_paid && onMarkAsPaid && (
                      <button onClick={() => onMarkAsPaid(expense.id)} className="btn-pay">
                        Marquer comme payé
                      </button>
                    )}

                    <button onClick={() => handleDownload(expense)} title="Télécharger PDF" className="btn-icon">
                      <DownloadIcon style={{ width: '20px', height: '20px' }} />
                    </button>

                    <button onClick={() => onDelete(expense)} title="Supprimer" className="btn-icon btn-delete">
                      <span>🗑️</span>
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
          usePortal={true}
          showExternalLink={true}
        />
      )}
    </div>
  );
};

export default UserExpensesAccordion;
