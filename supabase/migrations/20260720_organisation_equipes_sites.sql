BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_entreprise_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.entreprise_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_manage_own_entreprise(p_entreprise_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR (
      public.get_my_role() IN ('admin', 'responsable')
      AND public.get_my_entreprise_id() = p_entreprise_id
    );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

ALTER TABLE public.departements
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  departement_id uuid REFERENCES public.departements(id) ON DELETE SET NULL,
  nom text NOT NULL,
  code text,
  description text,
  couleur text DEFAULT '#0F766E',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipes_nom_unique UNIQUE (entreprise_id, nom)
);

CREATE TABLE IF NOT EXISTS public.employe_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  est_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employe_sites_unique UNIQUE (profile_id, site_id)
);

CREATE TABLE IF NOT EXISTS public.employe_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  est_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employe_equipes_unique UNIQUE (profile_id, equipe_id)
);

CREATE INDEX IF NOT EXISTS idx_equipes_entreprise_id ON public.equipes (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_equipes_site_id ON public.equipes (site_id);
CREATE INDEX IF NOT EXISTS idx_equipes_departement_id ON public.equipes (departement_id);
CREATE INDEX IF NOT EXISTS idx_employe_sites_profile_id ON public.employe_sites (profile_id);
CREATE INDEX IF NOT EXISTS idx_employe_sites_site_id ON public.employe_sites (site_id);
CREATE INDEX IF NOT EXISTS idx_employe_sites_entreprise_id ON public.employe_sites (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_employe_equipes_profile_id ON public.employe_equipes (profile_id);
CREATE INDEX IF NOT EXISTS idx_employe_equipes_equipe_id ON public.employe_equipes (equipe_id);
CREATE INDEX IF NOT EXISTS idx_employe_equipes_entreprise_id ON public.employe_equipes (entreprise_id);

DROP TRIGGER IF EXISTS trg_equipes_updated_at ON public.equipes;
CREATE TRIGGER trg_equipes_updated_at
BEFORE UPDATE ON public.equipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employe_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employe_equipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipes_select ON public.equipes;
DROP POLICY IF EXISTS equipes_insert ON public.equipes;
DROP POLICY IF EXISTS equipes_update ON public.equipes;
DROP POLICY IF EXISTS equipes_delete ON public.equipes;
CREATE POLICY equipes_select ON public.equipes FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR EXISTS (
    SELECT 1 FROM public.employe_equipes ee
    WHERE ee.equipe_id = equipes.id AND ee.profile_id = auth.uid()
  )
);
CREATE POLICY equipes_insert ON public.equipes FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY equipes_update ON public.equipes FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY equipes_delete ON public.equipes FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS employe_sites_select ON public.employe_sites;
DROP POLICY IF EXISTS employe_sites_insert ON public.employe_sites;
DROP POLICY IF EXISTS employe_sites_update ON public.employe_sites;
DROP POLICY IF EXISTS employe_sites_delete ON public.employe_sites;
CREATE POLICY employe_sites_select ON public.employe_sites FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY employe_sites_insert ON public.employe_sites FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_sites_update ON public.employe_sites FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_sites_delete ON public.employe_sites FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS employe_equipes_select ON public.employe_equipes;
DROP POLICY IF EXISTS employe_equipes_insert ON public.employe_equipes;
DROP POLICY IF EXISTS employe_equipes_update ON public.employe_equipes;
DROP POLICY IF EXISTS employe_equipes_delete ON public.employe_equipes;
CREATE POLICY employe_equipes_select ON public.employe_equipes FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY employe_equipes_insert ON public.employe_equipes FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_equipes_update ON public.employe_equipes FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_equipes_delete ON public.employe_equipes FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

COMMIT;