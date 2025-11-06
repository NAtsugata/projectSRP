// src/services/expenseService.js - SERVICE NOTES DE FRAIS
import { supabase } from '../lib/supabase';

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

const expenseService = {
  /**
   * Récupérer toutes les notes de frais d'un utilisateur
   */
  async getUserExpenses(userId) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      // Parser les receipts JSONB en tableaux
      const parsedData = data?.map(expense => ({
        ...expense,
        receipts: typeof expense.receipts === 'string' ? JSON.parse(expense.receipts || '[]') : (expense.receipts || [])
      })) || [];

      return { data: parsedData, error: null };
    } catch (error) {
      console.error('❌ Erreur getUserExpenses:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer toutes les notes de frais (admin)
   */
  async getAllExpenses() {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      // Parser les receipts JSONB en tableaux
      const parsedData = data?.map(expense => ({
        ...expense,
        receipts: typeof expense.receipts === 'string' ? JSON.parse(expense.receipts || '[]') : (expense.receipts || [])
      })) || [];

      return { data: parsedData, error: null };
    } catch (error) {
      console.error('❌ Erreur getAllExpenses:', error);
      return { data: null, error };
    }
  },

  /**
   * Créer une nouvelle note de frais
   */
  async createExpense({ userId, date, category, amount, description, receipts = [] }) {
    try {
      const expenseData = {
        user_id: userId,
        date,
        category,
        amount,
        description,
        receipts: JSON.stringify(receipts), // Stocker les photos en JSONB
        status: 'pending',
        admin_comment: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert([expenseData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Note de frais créée:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur createExpense:', error);
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

      console.log('✅ Note de frais approuvée:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur approveExpense:', error);
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

      console.log('✅ Note de frais rejetée:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur rejectExpense:', error);
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

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteError) throw deleteError;

      console.log('✅ Note de frais supprimée:', expenseId);
      return { data: true, error: null };
    } catch (error) {
      console.error('❌ Erreur deleteExpense:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer les statistiques des notes de frais
   */
  async getExpenseStats(userId = null) {
    try {
      let query = supabase
        .from('expenses')
        .select('status, amount');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        totalAmount: data.reduce((sum, e) => sum + (e.amount || 0), 0),
        pending: data.filter(e => e.status === 'pending').length,
        pendingAmount: data.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0),
        approved: data.filter(e => e.status === 'approved').length,
        approvedAmount: data.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0),
        rejected: data.filter(e => e.status === 'rejected').length,
        rejectedAmount: data.filter(e => e.status === 'rejected').reduce((sum, e) => sum + (e.amount || 0), 0)
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('❌ Erreur getExpenseStats:', error);
      return { data: null, error };
    }
  }
};

export default expenseService;
