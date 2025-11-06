-- ==========================================
-- TABLE: expenses (Notes de Frais)
-- ==========================================
-- À exécuter dans Supabase SQL Editor

-- Création de la table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('transport', 'meals', 'accommodation', 'supplies', 'phone', 'parking', 'fuel', 'other')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    receipts JSONB DEFAULT '[]'::jsonb, -- Array de {id, url, name, size}
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_reviewed_by ON public.expenses(reviewed_by);

-- Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Les employés peuvent voir leurs propres notes de frais
CREATE POLICY "Users can view their own expenses"
    ON public.expenses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Les employés peuvent créer leurs propres notes de frais
CREATE POLICY "Users can create their own expenses"
    ON public.expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Les employés peuvent supprimer leurs notes de frais en attente
CREATE POLICY "Users can delete their pending expenses"
    ON public.expenses
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Les admins peuvent tout voir
CREATE POLICY "Admins can view all expenses"
    ON public.expenses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- Policy: Les admins peuvent modifier toutes les notes de frais
CREATE POLICY "Admins can update all expenses"
    ON public.expenses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_expenses_updated_at_trigger ON public.expenses;
CREATE TRIGGER update_expenses_updated_at_trigger
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_expenses_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE public.expenses IS 'Notes de frais soumises par les employés';
COMMENT ON COLUMN public.expenses.user_id IS 'Employé qui a soumis la note de frais';
COMMENT ON COLUMN public.expenses.date IS 'Date de la dépense';
COMMENT ON COLUMN public.expenses.category IS 'Catégorie de frais: transport, meals, accommodation, supplies, phone, parking, fuel, other';
COMMENT ON COLUMN public.expenses.amount IS 'Montant en euros';
COMMENT ON COLUMN public.expenses.description IS 'Description de la dépense';
COMMENT ON COLUMN public.expenses.receipts IS 'Photos des justificatifs (array JSON)';
COMMENT ON COLUMN public.expenses.status IS 'Statut: pending, approved, rejected';
COMMENT ON COLUMN public.expenses.admin_comment IS 'Commentaire de l''admin lors de l''approbation/rejet';
COMMENT ON COLUMN public.expenses.reviewed_by IS 'Admin qui a traité la note de frais';
COMMENT ON COLUMN public.expenses.reviewed_at IS 'Date et heure de traitement par l''admin';

-- Données de test (optionnel - à supprimer en production)
-- INSERT INTO public.expenses (user_id, date, category, amount, description, status)
-- SELECT id, CURRENT_DATE, 'transport', 25.50, 'Taxi pour rendez-vous client', 'pending'
-- FROM auth.users WHERE email = 'employee@example.com' LIMIT 1;
