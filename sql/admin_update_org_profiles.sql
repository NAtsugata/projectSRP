-- Migration : autoriser les administrateurs à modifier les profils de leur organisation
--
-- Problème : la seule politique UPDATE sur `profiles` était `profiles_update_own`
-- (id = auth.uid()), donc un admin ne pouvait modifier QUE son propre profil.
-- Toute modification d'un autre employé (nom, statut RH...) mettait à jour 0 ligne
-- → l'UI affichait « enregistré » mais rien ne changeait.
--
-- Cette politique s'appuie sur les fonctions SECURITY DEFINER existantes
-- (is_admin() et current_user_org_id()) pour éviter toute récursion RLS.
-- Elle n'affecte PAS l'accès au coffre-fort, qui reste lié à user_id = auth.uid().

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  USING (public.is_admin() AND organization_id = public.current_user_org_id())
  WITH CHECK (public.is_admin() AND organization_id = public.current_user_org_id());
