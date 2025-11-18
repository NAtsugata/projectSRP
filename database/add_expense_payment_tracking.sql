-- ========================================
-- MIGRATION: Ajout du système de paiement pour notes de frais
-- ========================================
-- À exécuter dans Supabase SQL Editor
--
-- Cette migration ajoute les colonnes nécessaires pour marquer
-- les notes de frais comme payées et les archiver
--
-- ========================================

-- Ajouter les colonnes de paiement à la table expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id);

-- Créer un index sur is_paid pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_expenses_is_paid ON expenses(is_paid);

-- Créer un index composite pour filtrer les notes approuvées non payées
CREATE INDEX IF NOT EXISTS idx_expenses_status_paid ON expenses(status, is_paid);

-- Ajouter un commentaire sur les colonnes pour documentation
COMMENT ON COLUMN expenses.is_paid IS 'Indique si la note de frais a été payée/remboursée';
COMMENT ON COLUMN expenses.paid_date IS 'Date à laquelle la note de frais a été marquée comme payée';
COMMENT ON COLUMN expenses.paid_by IS 'ID de l''admin qui a marqué la note comme payée';

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Pour vérifier que les colonnes ont été ajoutées:
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'expenses'
-- AND column_name IN ('is_paid', 'paid_date', 'paid_by');
--
-- ========================================
