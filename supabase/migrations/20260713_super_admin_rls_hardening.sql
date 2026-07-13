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

ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entreprise_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employe_departements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entreprise_parametres_pointage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entreprises_select ON public.entreprises;
DROP POLICY IF EXISTS entreprises_insert ON public.entreprises;
DROP POLICY IF EXISTS entreprises_update ON public.entreprises;
DROP POLICY IF EXISTS entreprises_delete ON public.entreprises;
CREATE POLICY entreprises_select ON public.entreprises FOR SELECT USING (
  public.is_super_admin() OR id = public.get_my_entreprise_id()
);
CREATE POLICY entreprises_insert ON public.entreprises FOR INSERT WITH CHECK (
  public.is_super_admin()
);
CREATE POLICY entreprises_update ON public.entreprises FOR UPDATE USING (
  public.can_manage_own_entreprise(id)
) WITH CHECK (
  public.can_manage_own_entreprise(id)
);
CREATE POLICY entreprises_delete ON public.entreprises FOR DELETE USING (
  public.is_super_admin()
);

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR public.is_super_admin()
  OR public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND entreprise_id = public.get_my_entreprise_id()
  )
);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (
  auth.uid() = id
  OR public.is_super_admin()
  OR public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  auth.uid() = id
  OR public.is_super_admin()
  OR public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY profiles_delete ON public.profiles FOR DELETE USING (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND entreprise_id = public.get_my_entreprise_id()
    AND NOT COALESCE(is_super_admin, false)
    AND id <> auth.uid()
  )
);

DROP POLICY IF EXISTS entreprise_modules_select ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_insert ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_update ON public.entreprise_modules;
DROP POLICY IF EXISTS entreprise_modules_delete ON public.entreprise_modules;
CREATE POLICY entreprise_modules_select ON public.entreprise_modules FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_modules_insert ON public.entreprise_modules FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_modules_update ON public.entreprise_modules FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_modules_delete ON public.entreprise_modules FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS departements_select ON public.departements;
DROP POLICY IF EXISTS departements_insert ON public.departements;
DROP POLICY IF EXISTS departements_update ON public.departements;
DROP POLICY IF EXISTS departements_delete ON public.departements;
CREATE POLICY departements_select ON public.departements FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY departements_insert ON public.departements FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY departements_update ON public.departements FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY departements_delete ON public.departements FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS postes_select ON public.postes;
DROP POLICY IF EXISTS postes_insert ON public.postes;
DROP POLICY IF EXISTS postes_update ON public.postes;
DROP POLICY IF EXISTS postes_delete ON public.postes;
CREATE POLICY postes_select ON public.postes FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY postes_insert ON public.postes FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY postes_update ON public.postes FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY postes_delete ON public.postes FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS sites_select ON public.sites;
DROP POLICY IF EXISTS sites_insert ON public.sites;
DROP POLICY IF EXISTS sites_update ON public.sites;
DROP POLICY IF EXISTS sites_delete ON public.sites;
CREATE POLICY sites_select ON public.sites FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY sites_insert ON public.sites FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY sites_update ON public.sites FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY sites_delete ON public.sites FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS employe_departements_select ON public.employe_departements;
DROP POLICY IF EXISTS employe_departements_insert ON public.employe_departements;
DROP POLICY IF EXISTS employe_departements_update ON public.employe_departements;
DROP POLICY IF EXISTS employe_departements_delete ON public.employe_departements;
CREATE POLICY employe_departements_select ON public.employe_departements FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY employe_departements_insert ON public.employe_departements FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_departements_update ON public.employe_departements FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY employe_departements_delete ON public.employe_departements FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS entreprise_parametres_pointage_select ON public.entreprise_parametres_pointage;
DROP POLICY IF EXISTS entreprise_parametres_pointage_insert ON public.entreprise_parametres_pointage;
DROP POLICY IF EXISTS entreprise_parametres_pointage_update ON public.entreprise_parametres_pointage;
DROP POLICY IF EXISTS entreprise_parametres_pointage_delete ON public.entreprise_parametres_pointage;
CREATE POLICY entreprise_parametres_pointage_select ON public.entreprise_parametres_pointage FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_parametres_pointage_insert ON public.entreprise_parametres_pointage FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_parametres_pointage_update ON public.entreprise_parametres_pointage FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY entreprise_parametres_pointage_delete ON public.entreprise_parametres_pointage FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

COMMIT;
