BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_poste_secondaire_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_poste_secondaire_id_fkey
  FOREIGN KEY (poste_secondaire_id)
  REFERENCES public.postes(id)
  ON DELETE SET NULL;

COMMIT;