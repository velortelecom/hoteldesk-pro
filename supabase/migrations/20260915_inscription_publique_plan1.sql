-- =====================================================================
-- VELOR ONE - Inscription publique autonome (PLAN 1 UNIQUEMENT)
-- Date : 2026-09-15
--
-- Ce fichier s'appuie sur l'existant de la branche pointage-migration-draft :
--   - helpers RLS is_super_admin() / get_my_role() / get_my_entreprise_id()
--   - audit : record_audit_event()
--   - modele atomique : super_admin_create_entreprise_atomic()
--
-- Il ajoute strictement :
--   1. tracabilite de l'origine d'une entreprise (super_admin | inscription_autonome)
--   2. journal anti-abus des tentatives d'inscription publique
--   3. table demandes_pack (packs superieurs : demande -> activation manuelle)
--   4. RPC public_signup_create_entreprise_atomic (service_role uniquement)
--   5. garde-fou anti-escalade sur profiles.is_super_admin
--
-- AUCUNE policy n'est ouverte au role anon. L'inscription publique passe
-- exclusivement par l'Edge Function public-signup (service_role).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. ORIGINE DE L'ENTREPRISE
-- ---------------------------------------------------------------------
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'super_admin',
  ADD COLUMN IF NOT EXISTS nombre_employes integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entreprises_origine_check'
  ) THEN
    ALTER TABLE public.entreprises
      ADD CONSTRAINT entreprises_origine_check
      CHECK (origine IN ('super_admin', 'inscription_autonome'));
  END IF;
END
$$;

COMMENT ON COLUMN public.entreprises.origine IS
  'super_admin = creee depuis le back-office ; inscription_autonome = creee via la page publique /inscription';

-- ---------------------------------------------------------------------
-- 2. JOURNAL ANTI-ABUS DES TENTATIVES D'INSCRIPTION
-- Lu et ecrit uniquement par l'Edge Function (service_role).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inscriptions_tentatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adresse_ip inet,
  email text,
  succes boolean NOT NULL DEFAULT false,
  motif_echec text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inscriptions_tentatives_ip ON public.inscriptions_tentatives (adresse_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inscriptions_tentatives_email ON public.inscriptions_tentatives (lower(email), created_at DESC);

ALTER TABLE public.inscriptions_tentatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inscriptions_tentatives_select ON public.inscriptions_tentatives;
CREATE POLICY inscriptions_tentatives_select ON public.inscriptions_tentatives
FOR SELECT USING (public.is_super_admin());

REVOKE ALL ON public.inscriptions_tentatives FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.inscriptions_tentatives FROM authenticated;
GRANT SELECT ON public.inscriptions_tentatives TO authenticated;

-- ---------------------------------------------------------------------
-- 3. DEMANDES DE PACK SUPERIEUR
-- Un client ne peut jamais activer un pack : il depose une demande, le
-- Super Admin l'active manuellement quand le module existe reellement.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demandes_pack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  demandeur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pack_demande text,
  modules_demandes text[] NOT NULL DEFAULT '{}',
  message text,
  contact_email text,
  contact_telephone text,
  statut text NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_cours', 'traitee', 'refusee')),
  note_interne text,
  traite_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  traite_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.demandes_pack IS
  'Demandes de pack/module superieur. Aucune activation automatique : traitement manuel par le Super Admin.';

CREATE INDEX IF NOT EXISTS idx_demandes_pack_entreprise ON public.demandes_pack (entreprise_id);
CREATE INDEX IF NOT EXISTS idx_demandes_pack_statut ON public.demandes_pack (statut, created_at DESC);

ALTER TABLE public.demandes_pack ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demandes_pack_insert ON public.demandes_pack;
CREATE POLICY demandes_pack_insert ON public.demandes_pack
FOR INSERT WITH CHECK (
  public.is_super_admin()
  OR (
    public.get_my_role() = 'admin'
    AND entreprise_id = public.get_my_entreprise_id()
    AND demandeur_id = auth.uid()
    AND statut = 'nouvelle'
  )
);

DROP POLICY IF EXISTS demandes_pack_select ON public.demandes_pack;
CREATE POLICY demandes_pack_select ON public.demandes_pack
FOR SELECT USING (
  public.is_super_admin()
  OR (public.get_my_role() IN ('admin', 'responsable') AND entreprise_id = public.get_my_entreprise_id())
);

-- Seul le Super Admin fait evoluer une demande.
DROP POLICY IF EXISTS demandes_pack_update ON public.demandes_pack;
CREATE POLICY demandes_pack_update ON public.demandes_pack
FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS demandes_pack_delete ON public.demandes_pack;
CREATE POLICY demandes_pack_delete ON public.demandes_pack
FOR DELETE USING (public.is_super_admin());

REVOKE ALL ON public.demandes_pack FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_pack TO authenticated;

CREATE OR REPLACE FUNCTION public.demandes_pack_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demandes_pack_updated_at ON public.demandes_pack;
CREATE TRIGGER demandes_pack_updated_at
  BEFORE UPDATE ON public.demandes_pack
  FOR EACH ROW EXECUTE FUNCTION public.demandes_pack_touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. GARDE-FOU ANTI-ESCALADE : profiles.is_super_admin
-- Ouvrir l'inscription au public rend ce verrou necessaire : aucun compte
-- authentifie ne doit pouvoir se hisser en Super Admin, meme en forgeant
-- une requete PostgREST. service_role (Edge Functions) reste libre.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.empecher_escalade_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_modifie boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_modifie := COALESCE(NEW.is_super_admin, false);
  ELSE
    v_modifie := COALESCE(NEW.is_super_admin, false) IS DISTINCT FROM COALESCE(OLD.is_super_admin, false);
  END IF;

  IF v_modifie THEN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND NOT COALESCE(public.is_super_admin(), false) THEN
      RAISE EXCEPTION 'forbidden_super_admin_escalation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_anti_escalade ON public.profiles;
CREATE TRIGGER profiles_anti_escalade
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.empecher_escalade_super_admin();

-- ---------------------------------------------------------------------
-- 5. RPC ATOMIQUE D'INSCRIPTION PUBLIQUE
--
-- Calquee sur super_admin_create_entreprise_atomic, mais verrouillee :
--   - le plan est impose (starter) et n'est PAS un parametre
--   - la liste des modules est en dur ici (organisation + conges) et n'est
--     PAS un parametre : le navigateur ne peut donc rien activer d'autre
--   - le role du premier compte est en dur 'admin', is_super_admin false
--   - origine = 'inscription_autonome'
-- Tout se fait dans une seule transaction : une exception annule tout le
-- bloc SQL. Seul le compte Auth vit hors transaction, l'Edge Function le
-- supprime en cas d'echec.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_signup_create_entreprise_atomic(
  p_nom text,
  p_secteur text,
  p_email_contact text,
  p_telephone text,
  p_nombre_employes integer,
  p_departements jsonb,
  p_postes jsonb,
  p_admin_user_id uuid,
  p_admin_prenom text,
  p_admin_nom text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- SOURCE DE VERITE DU PLAN 1 (cote base). Toute evolution commerciale
  -- se fait ici, jamais depuis le client.
  c_plan              constant text    := 'starter';
  c_prix_mensuel      constant numeric := 29;
  c_max_utilisateurs  constant integer := 10;
  c_modules           constant text[]  := ARRAY['organisation', 'conges'];

  v_slug      text;
  v_base_slug text;
  v_ent_id    uuid;
  v_module_id text;
  v_dept      jsonb;
  v_poste     jsonb;
  v_dept_id   uuid;
  v_suffixe   integer := 1;
BEGIN
  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_admin_user';
  END IF;

  IF COALESCE(trim(p_nom), '') = '' THEN
    RAISE EXCEPTION 'missing_nom';
  END IF;

  v_base_slug := lower(regexp_replace(
    regexp_replace(
      translate(trim(p_nom), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
      '\s+', '-', 'g'),
    '[^a-z0-9-]', '', 'g'));

  IF v_base_slug = '' THEN
    v_base_slug := 'entreprise';
  END IF;

  -- Contrairement au back-office, une collision de nom ou de slug ne doit
  -- pas faire echouer une inscription publique : on suffixe.
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.entreprises e WHERE e.slug = v_slug) LOOP
    v_suffixe := v_suffixe + 1;
    v_slug := v_base_slug || '-' || v_suffixe;
    IF v_suffixe > 200 THEN
      RAISE EXCEPTION 'entreprise_slug_exists';
    END IF;
  END LOOP;

  INSERT INTO public.entreprises (
    nom, slug, secteur, plan, actif, prix_mensuel, max_utilisateurs,
    email_contact, telephone, adresse, origine, nombre_employes
  ) VALUES (
    trim(p_nom), v_slug,
    COALESCE(NULLIF(trim(p_secteur), ''), 'pme'),
    c_plan, true, c_prix_mensuel, c_max_utilisateurs,
    NULLIF(trim(COALESCE(p_email_contact, '')), ''),
    NULLIF(trim(COALESCE(p_telephone, '')), ''),
    NULL,
    'inscription_autonome',
    p_nombre_employes
  )
  RETURNING id INTO v_ent_id;

  -- Site principal
  INSERT INTO public.sites (entreprise_id, nom, slug, adresse, ville, pays, actif)
  VALUES (v_ent_id, trim(p_nom), v_slug || '-principal', '', '', 'France', true);

  -- Modules : liste en dur, jamais issue du client.
  FOREACH v_module_id IN ARRAY c_modules LOOP
    IF EXISTS (SELECT 1 FROM public.modules_catalogue m WHERE m.id = v_module_id) THEN
      INSERT INTO public.entreprise_modules (entreprise_id, module_id, actif, activated_at)
      VALUES (v_ent_id, v_module_id, true, now())
      ON CONFLICT (entreprise_id, module_id)
      DO UPDATE SET actif = true, activated_at = now();
    ELSE
      RAISE WARNING 'module Plan 1 absent de modules_catalogue : %', v_module_id;
    END IF;
  END LOOP;

  -- Departements du template secteur
  IF jsonb_typeof(COALESCE(p_departements, '[]'::jsonb)) = 'array' THEN
    FOR v_dept IN SELECT value FROM jsonb_array_elements(COALESCE(p_departements, '[]'::jsonb)) LOOP
      IF NULLIF(trim(COALESCE(v_dept->>'code', '')), '') IS NULL THEN
        CONTINUE;
      END IF;
      INSERT INTO public.departements (entreprise_id, nom, code, couleur, actif)
      VALUES (
        v_ent_id,
        COALESCE(NULLIF(trim(v_dept->>'nom'), ''), initcap(replace(v_dept->>'code', '_', ' '))),
        trim(v_dept->>'code'),
        COALESCE(NULLIF(trim(v_dept->>'couleur'), ''), '#6B7280'),
        true
      );
    END LOOP;
  END IF;

  -- Postes du template secteur
  IF jsonb_typeof(COALESCE(p_postes, '[]'::jsonb)) = 'array' THEN
    FOR v_poste IN SELECT value FROM jsonb_array_elements(COALESCE(p_postes, '[]'::jsonb)) LOOP
      IF NULLIF(trim(COALESCE(v_poste->>'slug', '')), '') IS NULL THEN
        CONTINUE;
      END IF;

      v_dept_id := NULL;
      IF NULLIF(trim(COALESCE(v_poste->>'dept', '')), '') IS NOT NULL THEN
        SELECT d.id INTO v_dept_id
        FROM public.departements d
        WHERE d.entreprise_id = v_ent_id AND d.code = trim(v_poste->>'dept')
        LIMIT 1;
      END IF;

      INSERT INTO public.postes (entreprise_id, nom, slug, departement_id, niveau, role_systeme, actif)
      VALUES (
        v_ent_id,
        COALESCE(NULLIF(trim(v_poste->>'nom'), ''), 'Poste'),
        trim(v_poste->>'slug'),
        v_dept_id,
        COALESCE(NULLIF((v_poste->>'niveau')::int, 0), 3),
        'employe',
        true
      );
    END LOOP;
  END IF;

  -- Premier Admin. role et is_super_admin sont ecrits en dur.
  INSERT INTO public.profiles (
    id, prenom, nom, role, entreprise_id, telephone, actif, is_super_admin
  ) VALUES (
    p_admin_user_id,
    COALESCE(NULLIF(trim(p_admin_prenom), ''), 'Admin'),
    COALESCE(NULLIF(trim(p_admin_nom), ''), trim(p_nom)),
    'admin',
    v_ent_id,
    NULLIF(trim(COALESCE(p_telephone, '')), ''),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    prenom = EXCLUDED.prenom,
    nom = EXCLUDED.nom,
    role = 'admin',
    entreprise_id = v_ent_id,
    telephone = EXCLUDED.telephone,
    actif = true,
    is_super_admin = false;

  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_ent_id,
    'slug', v_slug,
    'plan', c_plan,
    'modules', to_jsonb(c_modules)
  );
END;
$$;

-- Personne d'autre que les Edge Functions ne peut appeler cette RPC.
REVOKE ALL ON FUNCTION public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text
) TO service_role;

COMMIT;
