-- Extend profiles role constraint to support chef_equipe.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'responsable', 'chef_equipe', 'employe'));