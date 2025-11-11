-- ==========================================
-- TABLE: EXPENSES (NOTES DE FRAIS)
-- ==========================================
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('transport', 'meals', 'accommodation', 'supplies', 'phone', 'parking', 'fuel', 'other')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    receipts JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de {id, url, name, size}
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_reviewed_by ON public.expenses(reviewed_by);

-- RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Les employés voient leurs propres notes de frais
CREATE POLICY "Users can view their own expenses"
    ON public.expenses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Les employés peuvent créer leurs notes de frais
CREATE POLICY "Users can create their own expenses"
    ON public.expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Les employés peuvent modifier leurs notes de frais en attente
CREATE POLICY "Users can update their pending expenses"
    ON public.expenses
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Les employés peuvent supprimer leurs notes de frais en attente
CREATE POLICY "Users can delete their pending expenses"
    ON public.expenses
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Les admins voient toutes les notes de frais
CREATE POLICY "Admins can view all expenses"
    ON public.expenses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Policy: Les admins peuvent approuver/rejeter
CREATE POLICY "Admins can manage expenses"
    ON public.expenses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Policy: Les admins peuvent supprimer n'importe quelle note de frais
CREATE POLICY "Admins can delete any expense"
    ON public.expenses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Commentaires
COMMENT ON TABLE public.expenses IS 'Notes de frais soumises par les employés';
COMMENT ON COLUMN public.expenses.user_id IS 'Employé qui a soumis la note';
COMMENT ON COLUMN public.expenses.category IS 'Catégorie: transport, meals, accommodation, supplies, phone, parking, fuel, other';
COMMENT ON COLUMN public.expenses.amount IS 'Montant en euros';
COMMENT ON COLUMN public.expenses.receipts IS 'Justificatifs (photos) en JSONB: [{id, url, name, size}]';
COMMENT ON COLUMN public.expenses.status IS 'Statut: pending, approved, rejected';
COMMENT ON COLUMN public.expenses.reviewed_by IS 'Admin qui a traité la demande';

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_expenses_updated_at_trigger ON public.expenses;
CREATE TRIGGER update_expenses_updated_at_trigger
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_expenses_updated_at();
