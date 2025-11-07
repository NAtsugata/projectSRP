-- ==========================================
-- MIGRATION: Ajout des catégories manquantes dans expenses
-- ==========================================
-- Ce script ajoute les catégories 'phone', 'parking', 'fuel' à la contrainte CHECK
-- PROBLÈME: L'application permet de sélectionner ces catégories mais la DB les rejette

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. Ajouter la nouvelle contrainte avec toutes les catégories
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_category_check
CHECK (category IN (
    'transport',     -- 🚗 Transport
    'meals',         -- 🍽️ Repas
    'accommodation', -- 🏨 Hébergement
    'supplies',      -- 📦 Fournitures
    'phone',         -- 📱 Téléphone (NOUVEAU)
    'parking',       -- 🅿️ Parking (NOUVEAU)
    'fuel',          -- ⛽ Carburant (NOUVEAU)
    'other'          -- 📋 Autres
));

-- 3. Mettre à jour le commentaire pour refléter les nouvelles catégories
COMMENT ON COLUMN public.expenses.category IS 'Catégorie: transport, meals, accommodation, supplies, phone, parking, fuel, other';

-- 4. Vérification
SELECT
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'expenses_category_check';

-- 5. Test (optionnel - à décommenter pour tester)
-- INSERT INTO public.expenses (user_id, date, category, amount, description)
-- VALUES (auth.uid(), CURRENT_DATE, 'phone', 25.00, 'Test catégorie téléphone');
-- DELETE FROM public.expenses WHERE description = 'Test catégorie téléphone';

SELECT 'Migration terminée: 8 catégories autorisées (transport, meals, accommodation, supplies, phone, parking, fuel, other)' AS status;
