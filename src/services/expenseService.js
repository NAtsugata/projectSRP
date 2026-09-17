// src/services/expenseService.js - SERVICE NOTES DE FRAIS
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';
import { withOrgId, getOrgId } from '../utils/orgHelper';
import storageService, { dataUrlToBlob } from './storageService';

/**
 * Service pour gérer les notes de frais des employés
 *
 * Structure table "expenses":
 * - id: UUID
 * - user_id: UUID (référence users)
 * - date: DATE
 * - category: TEXT (transport, meals, accommodation, etc.)
 * - amount: DECIMAL
 * - description: TEXT
 * - receipts: JSONB (array de {id, url, name, size})
 * - status: TEXT (pending, approved, rejected)
 * - admin_comment: TEXT (optionnel)
 * - reviewed_by: UUID (référence users - admin qui a traité)
 * - reviewed_at: TIMESTAMP
 * - created_at: TIMESTAMP
 * - updated_at: TIMESTAMP
 */

// Colonnes des listes : tout sauf `receipts` (photos en base64, jusqu'à 2,4 Mo
// par ligne) — les justificatifs se chargent à la demande via getExpenseReceipts.
export const EXPENSE_LIST_COLUMNS =
  'id, user_id, date, category, amount, description, status, admin_comment, reviewed_by, ' +
  'reviewed_at, created_at, updated_at, is_paid, paid_date, paid_by, organization_id, receipts_count';

const parseReceipts = (raw) => {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const RECEIPTS_BUCKET = 'expense-receipts';

/**
 * Enregistre les justificatifs d'une note de frais dans Storage
 * ({org}/employees/{user}/expenses/{expense_id}/...) et dans expense_receipts.
 * Accepte des data URL (formulaire / anciens base64), des Blob, ou des
 * entrées déjà stockées ({ bucket, path }) qui sont conservées telles quelles.
 * Retourne la liste de métadonnées à stocker dans expenses.receipts (sans image).
 */
const persistReceipts = async ({ receipts, userId, expenseId }) => {
  const stored = [];
  const rows = [];
  for (let i = 0; i < (receipts || []).length; i++) {
    const r = receipts[i];
    if (r?.path && r?.bucket) { stored.push(r); continue; }
    const isDataUrl = typeof r?.url === 'string' && r.url.startsWith('data:');
    const blob = r instanceof Blob ? r : (r?.file instanceof Blob ? r.file : (isDataUrl ? dataUrlToBlob(r.url) : null));
    if (!blob) { stored.push(r); continue; } // URL http (ancien flux Storage) : conservée
    const { data, error } = await storageService.uploadExpenseReceipt(blob, { userId, expenseId, name: r?.name });
    if (error) throw error;
    stored.push({ id: r?.id || `${Date.now()}_${i}`, ...data });
    rows.push({
      expense_id: expenseId, organization_id: getOrgId(), user_id: userId,
      storage_path: data.path, file_name: data.name, file_size: data.size, mime_type: data.mime,
      original_index: i, migrated_from_base64: isDataUrl && !!r?._legacy,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from('expense_receipts').insert(rows);
    if (error) logger.warn('[expenses] métadonnées justificatifs non enregistrées:', error.message);
  }
  return stored;
};

/** Chemins Storage des justificatifs d'une note (à lire avant suppression) */
const listExpenseFilePaths = async (expenseId) => {
  const { data } = await supabase.from('expense_receipts').select('storage_path').eq('expense_id', expenseId);
  return (data || []).map(f => f.storage_path).filter(Boolean);
};

const expenseService = {
  /**
   * Récupérer toutes les notes de frais d'un utilisateur
   */
  async getUserExpenses(userId, page = 1, limit = 50, filters = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('expenses')
        .select(EXPENSE_LIST_COLUMNS, { count: 'exact' })
        .eq('user_id', userId)
        .range(from, to)
        .order('date', { ascending: false });

      // Handle legacy string argument if passed (backward compatibility)
      const statusFilter = typeof filters === 'string' ? filters : filters?.status;
      const actualFilters = typeof filters === 'object' ? filters : {};

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (actualFilters.startDate) {
        query = query.gte('date', actualFilters.startDate);
      }

      if (actualFilters.endDate) {
        query = query.lte('date', actualFilters.endDate);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Parser les receipts JSONB en tableaux
      const parsedData = data?.map(expense => ({
        ...expense,
        receipts: [],
        receipts_count: expense.receipts_count ?? 0
      })) || [];

      return { data: parsedData, error: null, count };
    } catch (error) {
      logger.error('❌ Erreur getUserExpenses:', error);
      return { data: null, error, count: 0 };
    }
  },

  /**
   * Récupérer toutes les notes de frais (admin)
   */
  async getAllExpenses(page = 1, limit = 50, filters = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('expenses')
        .select(EXPENSE_LIST_COLUMNS, { count: 'exact' })
        .range(from, to)
        .order('date', { ascending: false });

      // Filtres
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Parser les receipts JSONB en tableaux
      const parsedData = data?.map(expense => ({
        ...expense,
        receipts: [],
        receipts_count: expense.receipts_count ?? 0
      })) || [];

      return { data: parsedData, error: null, count };
    } catch (error) {
      logger.error('❌ Erreur getAllExpenses:', error);
      return { data: null, error, count: 0 };
    }
  },

  /**
   * Justificatifs d'une note de frais (chargés à la demande, hors des listes)
   */
  async getExpenseReceipts(expenseId) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('receipts')
        .eq('id', expenseId)
        .single();
      if (error) throw error;
      const receipts = parseReceipts(data?.receipts);
      const resolved = await Promise.all(receipts.map(async (r) =>
        (r?.path && r?.bucket) ? { ...r, url: await storageService.resolveFileUrl(r) } : r
      ));
      return { data: resolved, error: null };
    } catch (error) {
      logger.error('❌ Erreur getExpenseReceipts:', error);
      return { data: [], error };
    }
  },

  /**
   * Migration des anciens justificatifs (photos base64 en base) vers Storage.
   * Ne supprime rien : l'original reste dans expenses.receipts_legacy_base64
   * jusqu'à une purge explicite. Réservé aux administrateurs.
   */
  async migrateLegacyReceipts({ onProgress } = {}) {
    const summary = { total: 0, migrated: 0, files: 0, skipped: 0, errors: [] };
    try {
      const { data: candidates, error } = await supabase
        .from('expenses')
        .select('id, user_id, receipts_count')
        .gt('receipts_count', 0)
        .order('date', { ascending: true });
      if (error) throw error;
      const { data: done } = await supabase
        .from('expense_receipts').select('expense_id').not('storage_path', 'is', null);
      const doneIds = new Set((done || []).map(d => d.expense_id));
      const todo = (candidates || []).filter(c => !doneIds.has(c.id));
      summary.total = todo.length;

      for (let i = 0; i < todo.length; i++) {
        const { id, user_id } = todo[i];
        try {
          const { data: row, error: e1 } = await supabase.from('expenses').select('receipts').eq('id', id).single();
          if (e1) throw e1;
          const receipts = parseReceipts(row?.receipts);
          if (!receipts.some(r => typeof r?.url === 'string' && r.url.startsWith('data:'))) {
            summary.skipped++;
          } else {
            // Métadonnées vides laissées par une migration précédente jamais terminée
            await supabase.from('expense_receipts').delete().eq('expense_id', id).is('storage_path', null);
            const stored = await persistReceipts({
              receipts: receipts.map(r => ({ ...r, _legacy: true })), userId: user_id, expenseId: id,
            });
            const { error: e2 } = await supabase
              .from('expenses')
              .update({ receipts: stored, receipts_legacy_base64: row.receipts, updated_at: new Date().toISOString() })
              .eq('id', id);
            if (e2) throw e2;
            summary.migrated++;
            summary.files += stored.filter(r => r.path).length;
          }
        } catch (err) {
          summary.errors.push({ id, message: err.message });
        }
        onProgress?.(i + 1, todo.length, summary);
      }
      return { data: summary, error: null };
    } catch (error) {
      logger.error('❌ Erreur migrateLegacyReceipts:', error);
      return { data: summary, error };
    }
  },

  /**
   * Créer une nouvelle note de frais
   */
  async createExpense({ userId, date, category, amount, description, receipts = [] }) {
    try {
      // Identifiant généré ici : les fichiers sont rangés sous {expense_id}
      // avant même l'insertion de la ligne.
      const expenseId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : null;
      const storedReceipts = expenseId
        ? await persistReceipts({ receipts, userId, expenseId })
        : receipts;

      const expenseData = {
        ...(expenseId ? { id: expenseId } : {}),
        user_id: userId,
        date,
        category,
        amount,
        description,
        receipts: storedReceipts, // métadonnées uniquement ({ bucket, path, name, size, mime })
        status: 'pending',
        admin_comment: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert([withOrgId(expenseData)])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Note de frais créée:', data);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre à jour une note de frais
   */
  async updateExpense(expenseId, updates) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', expenseId)
        .select()
        .single();

      if (error) throw error;

      logger.log('Note de frais mise à jour:', expenseId);
      return { data, error: null };
    } catch (error) {
      logger.error('Erreur updateExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Approuver une note de frais (admin)
   */
  async approveExpense(expenseId, adminId, comment = '') {
    try {
      const updateData = {
        status: 'approved',
        admin_comment: comment || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Note de frais approuvée:', data);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur approveExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Rejeter une note de frais (admin)
   */
  async rejectExpense(expenseId, adminId, comment) {
    try {
      if (!comment || !comment.trim()) {
        throw new Error('Un commentaire est obligatoire pour rejeter une note de frais');
      }

      const updateData = {
        status: 'rejected',
        admin_comment: comment.trim(),
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Note de frais rejetée:', data);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur rejectExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une note de frais (employé - seulement si pending)
   */
  async deleteExpense(expenseId, userId) {
    try {
      // Vérifier que la note appartient bien à l'utilisateur et est en attente
      const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .single();

      if (fetchError) throw fetchError;
      if (!expense) throw new Error('Note de frais introuvable ou déjà traitée');

      const filePaths = await listExpenseFilePaths(expenseId);

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteError) throw deleteError;

      await storageService.removeFiles(RECEIPTS_BUCKET, filePaths);
      logger.log('✅ Note de frais supprimée:', expenseId);
      return { data: true, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une note de frais (admin - n'importe quel statut)
   */
  async deleteExpenseAdmin(expenseId) {
    try {
      // Vérifier que la note existe
      const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError) throw fetchError;
      if (!expense) throw new Error('Note de frais introuvable');

      const filePaths = await listExpenseFilePaths(expenseId);

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteError) throw deleteError;

      await storageService.removeFiles(RECEIPTS_BUCKET, filePaths);
      logger.log('✅ Note de frais supprimée (admin):', expenseId);
      return { data: true, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteExpenseAdmin:', error);
      return { data: null, error };
    }
  },

  /**
   * Marquer une note de frais comme payée (admin)
   */
  async markAsPaid(expenseId, adminId) {
    try {
      // Vérifier que la note est approuvée avant de la marquer comme payée
      const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchError) throw fetchError;
      if (!expense) throw new Error('Note de frais introuvable');
      if (expense.status !== 'approved') {
        throw new Error('Seules les notes approuvées peuvent être marquées comme payées');
      }

      const updateData = {
        is_paid: true,
        paid_by: adminId,
        paid_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Note de frais marquée comme payée:', data);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur markAsPaid:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer les statistiques des notes de frais
   * Optimisé: single pass O(n) au lieu de 8 passes
   */
  async getExpenseStats(userId = null) {
    try {
      let query = supabase
        .from('expenses')
        .select('status, amount, is_paid');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Single pass through data for all stats
      const stats = data.reduce((acc, expense) => {
        const amount = expense.amount || 0;
        acc.total++;
        acc.totalAmount += amount;

        if (expense.is_paid) {
          acc.paid++;
          acc.paidAmount += amount;
        } else if (expense.status === 'pending') {
          acc.pending++;
          acc.pendingAmount += amount;
        } else if (expense.status === 'approved') {
          acc.approved++;
          acc.approvedAmount += amount;
        } else if (expense.status === 'rejected') {
          acc.rejected++;
          acc.rejectedAmount += amount;
        }

        return acc;
      }, {
        total: 0,
        totalAmount: 0,
        pending: 0,
        pendingAmount: 0,
        approved: 0,
        approvedAmount: 0,
        paid: 0,
        paidAmount: 0,
        rejected: 0,
        rejectedAmount: 0
      });

      return { data: stats, error: null };
    } catch (error) {
      logger.error('❌ Erreur getExpenseStats:', error);
      return { data: null, error };
    }
  }
};

export default expenseService;
