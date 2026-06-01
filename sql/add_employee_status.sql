-- Migration : ajout du statut employé sur la table profiles
-- Le statut est purement informatif : il n'affecte PAS les RLS ni l'accès
-- au coffre-fort (celui-ci reste lié uniquement à user_id via auth.uid()).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_status text NOT NULL DEFAULT 'actif'
  CHECK (employee_status IN ('actif', 'inactif', 'licencié', 'retraité', 'démissionnaire', 'congé'));

COMMENT ON COLUMN public.profiles.employee_status IS
  'Statut RH de l''employé. Purement indicatif — ne modifie pas les accès Supabase.';
