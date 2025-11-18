/**
 * Service pour récupérer les statistiques des notes de frais
 * Utilise les vues matérialisées PostgreSQL pour des performances optimales sur mobile
 *
 * COMPATIBILITÉ MOBILE:
 * - iOS Safari: ✅ Compatible
 * - Android Chrome: ✅ Compatible
 * - Calculs effectués côté serveur (PostgreSQL)
 * - Fallback vers calcul client si vues pas disponibles
 */

import { supabase } from '../lib/supabase';

/**
 * Récupère les statistiques globales depuis la vue matérialisée
 * Optimisé pour mobile - pas de calculs lourds côté client
 *
 * @returns {Promise<{data: object, error: any}>}
 */
export const getGlobalStats = async () => {
  try {
    // Essayer d'utiliser la fonction sécurisée qui lit la vue matérialisée
    const { data, error } = await supabase
      .rpc('get_expense_global_stats');

    if (error) {
      // Si la fonction n'existe pas encore (code 42883 = function not found)
      if (error.code === '42883' || error.code === '42P01') {
        console.warn('Vues matérialisées non disponibles, utilisation du fallback');
        return await getGlobalStatsFallback();
      }
      throw error;
    }

    // Transformer les données de la vue matérialisée en format attendu
    const stats = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 }
    };

    if (data && Array.isArray(data)) {
      data.forEach(row => {
        if (row.is_paid) {
          // Toutes les expenses payées vont dans "paid"
          stats.paid.count += Number(row.count);
          stats.paid.total += Number(row.total_amount);
        } else {
          // Sinon, grouper par statut
          const status = row.status;
          if (stats[status]) {
            stats[status].count += Number(row.count);
            stats[status].total += Number(row.total_amount);
          }
        }
      });
    }

    return { data: stats, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des stats globales:', error);
    return { data: null, error };
  }
};

/**
 * Récupère les statistiques d'un utilisateur spécifique
 *
 * @param {string|null} userId - ID de l'utilisateur (null = utilisateur connecté)
 * @returns {Promise<{data: object, error: any}>}
 */
export const getUserStats = async (userId = null) => {
  try {
    // Appeler la fonction sécurisée avec RLS
    const { data, error } = await supabase
      .rpc('get_expense_stats_by_user', { target_user_id: userId });

    if (error) {
      if (error.code === '42883' || error.code === '42P01') {
        console.warn('Vues matérialisées non disponibles, utilisation du fallback');
        return await getUserStatsFallback(userId);
      }
      throw error;
    }

    // Transformer en format attendu
    const stats = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
      lastExpenseDate: null
    };

    if (data && Array.isArray(data)) {
      data.forEach(row => {
        if (row.is_paid) {
          stats.paid.count += Number(row.count);
          stats.paid.total += Number(row.total_amount);
        } else {
          const status = row.status;
          if (stats[status]) {
            stats[status].count += Number(row.count);
            stats[status].total += Number(row.total_amount);
          }
        }

        // Garder la date la plus récente
        if (row.last_expense_date) {
          const rowDate = new Date(row.last_expense_date);
          if (!stats.lastExpenseDate || rowDate > stats.lastExpenseDate) {
            stats.lastExpenseDate = rowDate;
          }
        }
      });
    }

    return { data: stats, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des stats utilisateur:', error);
    return { data: null, error };
  }
};

/**
 * Récupère les statistiques mensuelles (12 derniers mois)
 *
 * @returns {Promise<{data: array, error: any}>}
 */
export const getMonthlyStats = async () => {
  try {
    const { data, error } = await supabase
      .from('expense_stats_by_month')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);

    if (error) {
      if (error.code === '42P01') {
        console.warn('Vue mensuelle non disponible');
        return { data: [], error: null };
      }
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des stats mensuelles:', error);
    return { data: [], error };
  }
};

/**
 * Récupère les notes de frais à payer (admin uniquement)
 *
 * @returns {Promise<{data: array, error: any}>}
 */
export const getExpensesToPay = async () => {
  try {
    const { data, error } = await supabase
      .from('expenses_to_pay')
      .select('*')
      .order('pending_total', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.warn('Vue expenses_to_pay non disponible');
        return await getExpensesToPayFallback();
      }
      throw error;
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des expenses à payer:', error);
    return { data: [], error };
  }
};

/**
 * Rafraîchit les vues matérialisées temps réel
 * À appeler après approve, reject, markAsPaid
 *
 * @returns {Promise<{success: boolean, error: any}>}
 */
export const refreshRealtimeStats = async () => {
  try {
    const { error } = await supabase
      .rpc('refresh_realtime_expense_stats');

    if (error) {
      // Si la fonction n'existe pas, ne pas échouer
      if (error.code === '42883') {
        console.warn('Fonction de rafraîchissement non disponible');
        return { success: true, error: null };
      }
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erreur lors du rafraîchissement des stats:', error);
    return { success: false, error };
  }
};

/**
 * Rafraîchit toutes les vues matérialisées
 * À appeler manuellement si besoin (ou via cron job)
 *
 * @returns {Promise<{success: boolean, error: any}>}
 */
export const refreshAllStats = async () => {
  try {
    const { error } = await supabase
      .rpc('refresh_all_expense_stats');

    if (error) {
      if (error.code === '42883') {
        console.warn('Fonction de rafraîchissement non disponible');
        return { success: true, error: null };
      }
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erreur lors du rafraîchissement de toutes les stats:', error);
    return { success: false, error };
  }
};

// ====================================
// FONCTIONS FALLBACK (calcul client)
// ====================================

/**
 * Fallback: Calcule les stats globales côté client
 * Utilisé si les vues matérialisées ne sont pas encore déployées
 */
const getGlobalStatsFallback = async () => {
  try {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('status, is_paid, amount')
      .is('deleted_at', null);

    if (error) throw error;

    const stats = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 }
    };

    if (expenses && Array.isArray(expenses)) {
      expenses.forEach(expense => {
        const amount = Number(expense.amount) || 0;

        if (expense.is_paid) {
          stats.paid.count++;
          stats.paid.total += amount;
        } else {
          const status = expense.status;
          if (stats[status]) {
            stats[status].count++;
            stats[status].total += amount;
          }
        }
      });
    }

    return { data: stats, error: null };
  } catch (error) {
    console.error('Erreur fallback stats globales:', error);
    return { data: null, error };
  }
};

/**
 * Fallback: Calcule les stats utilisateur côté client
 */
const getUserStatsFallback = async (userId) => {
  try {
    let query = supabase
      .from('expenses')
      .select('status, is_paid, amount, date')
      .is('deleted_at', null);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: expenses, error } = await query;

    if (error) throw error;

    const stats = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
      lastExpenseDate: null
    };

    if (expenses && Array.isArray(expenses)) {
      expenses.forEach(expense => {
        const amount = Number(expense.amount) || 0;

        if (expense.is_paid) {
          stats.paid.count++;
          stats.paid.total += amount;
        } else {
          const status = expense.status;
          if (stats[status]) {
            stats[status].count++;
            stats[status].total += amount;
          }
        }

        // Dernière date
        if (expense.date) {
          const expenseDate = new Date(expense.date);
          if (!stats.lastExpenseDate || expenseDate > stats.lastExpenseDate) {
            stats.lastExpenseDate = expenseDate;
          }
        }
      });
    }

    return { data: stats, error: null };
  } catch (error) {
    console.error('Erreur fallback stats utilisateur:', error);
    return { data: null, error };
  }
};

/**
 * Fallback: Récupère les expenses à payer côté client
 */
const getExpensesToPayFallback = async () => {
  try {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('user_id, amount, date')
      .eq('status', 'approved')
      .eq('is_paid', false)
      .is('deleted_at', null);

    if (error) throw error;

    // Grouper par utilisateur
    const userMap = new Map();

    if (expenses && Array.isArray(expenses)) {
      expenses.forEach(expense => {
        const userId = expense.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            user_id: userId,
            pending_count: 0,
            pending_total: 0,
            oldest_expense_date: expense.date,
            newest_expense_date: expense.date
          });
        }

        const userStats = userMap.get(userId);
        userStats.pending_count++;
        userStats.pending_total += Number(expense.amount) || 0;

        // Mettre à jour les dates
        if (expense.date < userStats.oldest_expense_date) {
          userStats.oldest_expense_date = expense.date;
        }
        if (expense.date > userStats.newest_expense_date) {
          userStats.newest_expense_date = expense.date;
        }
      });
    }

    return { data: Array.from(userMap.values()), error: null };
  } catch (error) {
    console.error('Erreur fallback expenses à payer:', error);
    return { data: [], error };
  }
};

// Export par défaut
export default {
  getGlobalStats,
  getUserStats,
  getMonthlyStats,
  getExpensesToPay,
  refreshRealtimeStats,
  refreshAllStats
};
