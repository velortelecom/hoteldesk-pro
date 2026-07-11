-- DRAFT -- NON EXECUTE -- NON VALIDE EN PRODUCTION
-- Ce fichier depend de la verification du schema reel Supabase.
-- ============================================================
-- MIGRATION : Module Pointage (GPS) - Velor One
-- ============================================================

BEGIN;

-- ============================================================
-- 0. VERIFICATION DES PREREQUIS (echec propre si schema incoherent)
-- ============================================================
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.entreprises') IS NULL THEN
    v_missing := array_append(v_missing, 'public.entreprises');
  END IF;
  IF to_regclass('public.sites') IS NULL THEN
    v_missing := array_append(v_missing, 'public.sites');
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.profiles');
  END IF;
  IF to_regclass('public.entreprise_modules') IS NULL THEN
    v_missing := array_append(v_missing, 'public.entreprise_modules');
  END IF;
  IF to_regclass('public.employe_departements') IS NULL THEN
    v_missing := array_append(v_missing, 'public.employe_departements');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration Pointage annulee : table(s) prerequise(s) manquante(s) : %. Verifiez le schema avant de relancer.', array_to_string(v_missing, ', ');
  END IF;
END $$;

DO $$
DECLARE
  v_missing_cols text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='entreprises' AND column_name='id') THEN
    v_missing_cols := array_append(v_missing_cols, 'entreprises.id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sites' AND column_name='id') THEN
    v_missing_cols := array_append(v_missing_cols, 'sites.id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id') THEN
    v_missing_cols := array_append(v_missing_cols, 'profiles.id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='entreprise_id') THEN
    v_missing_cols := array_append(v_missing_cols, 'profiles.entreprise_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employe_departements' AND column_name='profile_id') THEN
    v_missing_cols := array_append(v_missing_cols, 'employe_departements.profile_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employe_departements' AND column_name='departement_id') THEN
    v_missing_cols := array_append(v_missing_cols, 'employe_departements.departement_id');
  END IF;

  IF array_length(v_missing_cols, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration Pointage annulee : colonne(s) prerequise(s) manquante(s) : %.', array_to_string(v_missing_cols, ', ');
  END IF;
END $$;

DO $$
DECLARE
  v_bad_types text[] := ARRAY[]::text[];
  v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='entreprises' AND column_name='id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('entreprises.id (%s)', v_type)); END IF;

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='sites' AND column_name='id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('sites.id (%s)', v_type)); END IF;

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('profiles.id (%s)', v_type)); END IF;

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='entreprise_id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('profiles.entreprise_id (%s)', v_type)); END IF;

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employe_departements' AND column_name='profile_id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('employe_departements.profile_id (%s)', v_type)); END IF;

  SELECT data_type INTO v_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employe_departements' AND column_name='departement_id';
  IF v_type IS DISTINCT FROM 'uuid' THEN v_bad_types := array_append(v_bad_types, format('employe_departements.departement_id (%s)', v_type)); END IF;

  IF array_length(v_bad_types, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration Pointage annulee : type(s) de colonne inattendu(s) : %. Adapter la migration avant de relancer.', array_to_string(v_bad_types, ', ');
  END IF;
END $$;

-- ============================================================
-- 1. Colonnes GPS sur sites
-- ============================================================
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS rayon_pointage_metres integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pointage_gps_obligatoire boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. Table pointages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pointages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entreprise_id uuid NOT NULL,
    site_id uuid,
    profile_id uuid NOT NULL,
    action text NOT NULL,
    statut text NOT NULL,
    motif_refus text,
    latitude double precision,
    longitude double precision,
    distance_metres numeric(10,2),
    precision_metres numeric(10,2),
    methode text NOT NULL DEFAULT 'gps',
    appareil text,
    user_agent text,
    ip_address inet,
    timezone text,
    commentaire text,
    duree_minutes integer,
    vitesse_estimee_kmh numeric(10,2),
    position_suspecte boolean NOT NULL DEFAULT false,
    metadonnees jsonb,
    horodatage_evenement timestamptz NOT NULL DEFAULT now(),
    cree_hors_ligne boolean NOT NULL DEFAULT false,
    synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

ALTER TABLE public.pointages
  ADD COLUMN IF NOT EXISTS entreprise_id uuid,
  ADD COLUMN IF NOT EXISTS site_id uuid,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS statut text,
  ADD COLUMN IF NOT EXISTS motif_refus text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS distance_metres numeric(10,2),
  ADD COLUMN IF NOT EXISTS precision_metres numeric(10,2),
  ADD COLUMN IF NOT EXISTS methode text DEFAULT 'gps',
  ADD COLUMN IF NOT EXISTS appareil text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS commentaire text,
  ADD COLUMN IF NOT EXISTS duree_minutes integer,
  ADD COLUMN IF NOT EXISTS vitesse_estimee_kmh numeric(10,2),
  ADD COLUMN IF NOT EXISTS position_suspecte boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadonnees jsonb,
  ADD COLUMN IF NOT EXISTS horodatage_evenement timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cree_hors_ligne boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_action_check;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_action_check
  CHECK (action IN ('arrivee','depart','debut_pause','fin_pause'));

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_statut_check;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_statut_check
  CHECK (statut IN ('accepte','refuse','en_attente_correction','corrige'));

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_motif_refus_check;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_motif_refus_check
  CHECK (motif_refus IS NULL OR motif_refus IN (
      'hors_zone','double_arrivee','depart_sans_arrivee',
      'pause_incoherente','site_non_configure','gps_manquant'
    ));

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_duree_minutes_check;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_duree_minutes_check
  CHECK (duree_minutes IS NULL OR duree_minutes >= 0);

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_methode_check;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_methode_check
  CHECK (methode = 'gps');

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_entreprise_id_fkey;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_entreprise_id_fkey
  FOREIGN KEY (entreprise_id) REFERENCES public.entreprises(id) ON DELETE CASCADE;

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_site_id_fkey;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.pointages DROP CONSTRAINT IF EXISTS pointages_profile_id_fkey;
ALTER TABLE public.pointages ADD CONSTRAINT pointages_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pointages_entreprise_created ON public.pointages(entreprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pointages_profile_created ON public.pointages(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pointages_site_created ON public.pointages(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pointages_statut_created ON public.pointages(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pointages_profile_horodatage ON public.pointages(profile_id, horodatage_evenement DESC);

-- ============================================================
-- 3. Table corrections_pointage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.corrections_pointage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entreprise_id uuid NOT NULL,
    pointage_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    demande_par uuid NOT NULL,
    valide_par uuid,
    ancien_statut text,
    nouveau_statut text,
    commentaire text,
    statut text NOT NULL DEFAULT 'en_attente',
    created_at timestamptz NOT NULL DEFAULT now(),
    validated_at timestamptz
  );

ALTER TABLE public.corrections_pointage
  ADD COLUMN IF NOT EXISTS entreprise_id uuid,
  ADD COLUMN IF NOT EXISTS pointage_id uuid,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS demande_par uuid,
  ADD COLUMN IF NOT EXISTS valide_par uuid,
  ADD COLUMN IF NOT EXISTS ancien_statut text,
  ADD COLUMN IF NOT EXISTS nouveau_statut text,
  ADD COLUMN IF NOT EXISTS commentaire text,
  ADD COLUMN IF NOT EXISTS statut text DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

ALTER TABLE public.corrections_pointage DROP CONSTRAINT IF EXISTS corrections_statut_check;
ALTER TABLE public.corrections_pointage ADD CONSTRAINT corrections_statut_check
  CHECK (statut IN ('en_attente','validee','refusee'));

ALTER TABLE public.corrections_pointage DROP CONSTRAINT IF EXISTS corrections_pointage_id_fkey;
ALTER TABLE public.corrections_pointage ADD CONSTRAINT corrections_pointage_id_fkey
  FOREIGN KEY (pointage_id) REFERENCES public.pointages(id) ON DELETE CASCADE;

ALTER TABLE public.corrections_pointage DROP CONSTRAINT IF EXISTS corrections_profile_id_fkey;
ALTER TABLE public.corrections_pointage ADD CONSTRAINT corrections_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.corrections_pointage DROP CONSTRAINT IF EXISTS corrections_demande_par_fkey;
ALTER TABLE public.corrections_pointage ADD CONSTRAINT corrections_demande_par_fkey
  FOREIGN KEY (demande_par) REFERENCES public.profiles(id);

ALTER TABLE public.corrections_pointage DROP CONSTRAINT IF EXISTS corrections_valide_par_fkey;
ALTER TABLE public.corrections_pointage ADD CONSTRAINT corrections_valide_par_fkey
  FOREIGN KEY (valide_par) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_corrections_entreprise_created ON public.corrections_pointage(entreprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_profile_created ON public.corrections_pointage(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_pointage_id ON public.corrections_pointage(pointage_id);
CREATE INDEX IF NOT EXISTS idx_corrections_statut_created ON public.corrections_pointage(statut, created_at DESC);

CREATE OR REPLACE FUNCTION public.corrections_pointage_prevent_immutable_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entreprise_id IS DISTINCT FROM OLD.entreprise_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.pointage_id IS DISTINCT FROM OLD.pointage_id
     OR NEW.demande_par IS DISTINCT FROM OLD.demande_par THEN
    RAISE EXCEPTION 'Modification interdite de entreprise_id, profile_id, pointage_id ou demande_par';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corrections_pointage_immutable ON public.corrections_pointage;
CREATE TRIGGER trg_corrections_pointage_immutable
BEFORE UPDATE ON public.corrections_pointage
FOR EACH ROW
EXECUTE FUNCTION public.corrections_pointage_prevent_immutable_changes();

-- ============================================================
-- 4. Table entreprise_parametres_pointage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entreprise_parametres_pointage (
    entreprise_id uuid PRIMARY KEY REFERENCES public.entreprises(id) ON DELETE CASCADE,
    precision_gps_max_metres integer NOT NULL DEFAULT 50,
    gps_obligatoire boolean NOT NULL DEFAULT true,
    autoriser_hors_zone_avec_validation boolean NOT NULL DEFAULT false,
    duree_max_entre_pointages_minutes integer,
    methodes_actives jsonb NOT NULL DEFAULT '{"gps": true}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

ALTER TABLE public.entreprise_parametres_pointage
  ADD COLUMN IF NOT EXISTS precision_gps_max_metres integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS gps_obligatoire boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS autoriser_hors_zone_avec_validation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS duree_max_entre_pointages_minutes integer,
  ADD COLUMN IF NOT EXISTS methodes_actives jsonb DEFAULT '{"gps": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.entreprise_parametres_pointage DROP CONSTRAINT IF EXISTS parametres_precision_check;
ALTER TABLE public.entreprise_parametres_pointage ADD CONSTRAINT parametres_precision_check
  CHECK (precision_gps_max_metres > 0 AND precision_gps_max_metres <= 1000);

ALTER TABLE public.entreprise_parametres_pointage DROP CONSTRAINT IF EXISTS parametres_duree_max_check;
ALTER TABLE public.entreprise_parametres_pointage ADD CONSTRAINT parametres_duree_max_check
  CHECK (duree_max_entre_pointages_minutes IS NULL OR duree_max_entre_pointages_minutes > 0);

ALTER TABLE public.entreprise_parametres_pointage DROP CONSTRAINT IF EXISTS parametres_methodes_actives_check;
ALTER TABLE public.entreprise_parametres_pointage ADD CONSTRAINT parametres_methodes_actives_check
  CHECK (jsonb_typeof(methodes_actives) = 'object');

CREATE OR REPLACE FUNCTION public.parametres_pointage_prevent_entreprise_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entreprise_id IS DISTINCT FROM OLD.entreprise_id THEN
    RAISE EXCEPTION 'Modification interdite de entreprise_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parametres_pointage_immutable ON public.entreprise_parametres_pointage;
CREATE TRIGGER trg_parametres_pointage_immutable
BEFORE UPDATE ON public.entreprise_parametres_pointage
FOR EACH ROW
EXECUTE FUNCTION public.parametres_pointage_prevent_entreprise_change();

DROP TRIGGER IF EXISTS trg_parametres_pointage_updated_at ON public.entreprise_parametres_pointage;
CREATE TRIGGER trg_parametres_pointage_updated_at
BEFORE UPDATE ON public.entreprise_parametres_pointage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.pointages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections_pointage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entreprise_parametres_pointage ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Policies pointages : SELECT uniquement, aucun INSERT direct.
-- Seul service_role (via create-pointage) peut ecrire.
-- ============================================================
DROP POLICY IF EXISTS pointages_select ON public.pointages;
CREATE POLICY pointages_select ON public.pointages
FOR SELECT USING (
    is_super_admin()
    OR (
      entreprise_id = get_my_entreprise_id()
      AND (
        get_my_role() = 'admin'
        OR profile_id = auth.uid()
        OR (
          get_my_role() = 'responsable'
          AND EXISTS (
            SELECT 1
            FROM public.employe_departements ed_responsable
            JOIN public.employe_departements ed_employe
              ON ed_employe.departement_id = ed_responsable.departement_id
            WHERE ed_responsable.profile_id = auth.uid()
              AND ed_employe.profile_id = pointages.profile_id
          )
        )
      )
    )
  );

-- ============================================================
-- 7. Policies corrections_pointage
-- ============================================================
DROP POLICY IF EXISTS corrections_select ON public.corrections_pointage;
CREATE POLICY corrections_select ON public.corrections_pointage
FOR SELECT USING (
    is_super_admin()
    OR (
      entreprise_id = get_my_entreprise_id()
      AND (
        get_my_role() = 'admin'
        OR profile_id = auth.uid()
        OR (
          get_my_role() = 'responsable'
          AND EXISTS (
            SELECT 1
            FROM public.employe_departements ed_responsable
            JOIN public.employe_departements ed_employe
              ON ed_employe.departement_id = ed_responsable.departement_id
            WHERE ed_responsable.profile_id = auth.uid()
              AND ed_employe.profile_id = corrections_pointage.profile_id
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS corrections_insert ON public.corrections_pointage;
CREATE POLICY corrections_insert ON public.corrections_pointage
FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND demande_par = auth.uid()
    AND entreprise_id = get_my_entreprise_id()
    AND EXISTS (
      SELECT 1 FROM public.pointages p
      WHERE p.id = corrections_pointage.pointage_id
        AND p.profile_id = corrections_pointage.profile_id
        AND p.entreprise_id = corrections_pointage.entreprise_id
    )
  );

DROP POLICY IF EXISTS corrections_update ON public.corrections_pointage;
CREATE POLICY corrections_update ON public.corrections_pointage
FOR UPDATE USING (
    is_super_admin()
    OR (
      entreprise_id = get_my_entreprise_id()
      AND (
        get_my_role() = 'admin'
        OR (
          get_my_role() = 'responsable'
          AND EXISTS (
            SELECT 1
            FROM public.employe_departements ed_responsable
            JOIN public.employe_departements ed_employe
              ON ed_employe.departement_id = ed_responsable.departement_id
            WHERE ed_responsable.profile_id = auth.uid()
              AND ed_employe.profile_id = corrections_pointage.profile_id
          )
        )
      )
    )
  )
WITH CHECK (
    is_super_admin()
    OR (
      entreprise_id = get_my_entreprise_id()
      AND (
        get_my_role() = 'admin'
        OR (
          get_my_role() = 'responsable'
          AND EXISTS (
            SELECT 1
            FROM public.employe_departements ed_responsable
            JOIN public.employe_departements ed_employe
              ON ed_employe.departement_id = ed_responsable.departement_id
            WHERE ed_responsable.profile_id = auth.uid()
              AND ed_employe.profile_id = corrections_pointage.profile_id
          )
        )
      )
    )
  );

-- ============================================================
-- 8. Policies entreprise_parametres_pointage
-- Lecture : admin/responsable de l'entreprise, ou super admin.
-- Ecriture : admin de l'entreprise, ou super admin. Aucun acces employe.
-- ============================================================
DROP POLICY IF EXISTS parametres_pointage_select ON public.entreprise_parametres_pointage;
CREATE POLICY parametres_pointage_select ON public.entreprise_parametres_pointage
FOR SELECT USING (
    is_super_admin()
    OR (
      entreprise_id = get_my_entreprise_id()
      AND get_my_role() IN ('admin', 'responsable')
    )
  );

DROP POLICY IF EXISTS parametres_pointage_insert ON public.entreprise_parametres_pointage;
CREATE POLICY parametres_pointage_insert ON public.entreprise_parametres_pointage
FOR INSERT WITH CHECK (
    is_super_admin()
    OR (entreprise_id = get_my_entreprise_id() AND get_my_role() = 'admin')
  );

DROP POLICY IF EXISTS parametres_pointage_update ON public.entreprise_parametres_pointage;
CREATE POLICY parametres_pointage_update ON public.entreprise_parametres_pointage
FOR UPDATE USING (
    is_super_admin()
    OR (entreprise_id = get_my_entreprise_id() AND get_my_role() = 'admin')
  )
WITH CHECK (
    is_super_admin()
    OR (entreprise_id = get_my_entreprise_id() AND get_my_role() = 'admin')
  );

COMMIT;

-- ============================================================
-- FIN DE FICHIER -- rappel : NON EXECUTE, NON VALIDE.
-- Requetes de verification et script de rollback : voir la
-- conversation de preparation, a fournir dans un fichier separe
-- une fois la migration validee et executee.
-- ============================================================
