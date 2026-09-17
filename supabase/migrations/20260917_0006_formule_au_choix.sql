-- =====================================================================
-- 20260917_0006 : LE VISITEUR CHOISIT SA FORMULE A L'INSCRIPTION
--
-- Jusqu'ici la RPC imposait 'starter' : personne ne pouvait s'inscrire en
-- Gratuit. Elle accepte desormais une formule, et une seule chose vient
-- du navigateur : LE NOM DE LA FORMULE. Ni le prix, ni les modules, ni le
-- plafond d'utilisateurs -- tout cela est ecrit en dur ici, et une valeur
-- inconnue retombe sur l'offre payante.
--
-- LE TARIF FONDATEUR N'EST PAS DECIDE ICI
--   Le trigger trg_tarif_fondateur (20260917_0005) l'applique a l'INSERT
--   et lui seul compte les places. Il ignore deja tout plan qui n'est pas
--   'starter', donc une inscription en Gratuit ne consomme aucune place.
--   Un seul endroit decide du tarif : c'est ce qui evite qu'ils divergent.
--
-- POURQUOI IL FAUT SUPPRIMER L'ANCIENNE FONCTION D'ABORD
--   Le nouveau parametre a un DEFAULT. Sans le DROP, Postgres garderait
--   DEUX fonctions -- celle a 10 parametres et celle a 11 -- et un appel a
--   10 arguments deviendrait ambigu : "function is not unique". L'Edge
--   Function actuelle passe 10 arguments. L'inscription tomberait.
--
-- CETTE MIGRATION A ETE PRODUITE PAR PATCH DU FICHIER D'ORIGINE, pas par
-- recopie : 170 lignes retapees a la main sur le chemin d'inscription,
-- c'est exactement la qu'une faute de frappe ne se pardonne pas.
--
-- Idempotent : rejouable sans effet de bord.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. L'ancienne signature disparait
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text
);

-- ---------------------------------------------------------------------
-- 2. La nouvelle
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
  p_admin_nom text,
  -- Formule choisie par le visiteur : 'gratuit' ou 'starter'. DEFAULT pour
  -- que l'ancien appel a 10 parametres continue de fonctionner.
  p_formule text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- SOURCE DE VERITE DES FORMULES (cote base). Toute evolution
  -- commerciale se fait ici, jamais depuis le client.
  --
  -- Le navigateur choisit une FORMULE, jamais un prix ni une liste de
  -- modules : p_formule n'est qu'un aiguillage vers des valeurs ecrites
  -- ci-dessous. Une valeur inconnue retombe sur l'offre payante.
  --
  -- Le TARIF FONDATEUR n'est PAS decide ici : le trigger
  -- trg_tarif_fondateur (migration 20260917_0005) l'applique a l'INSERT,
  -- et lui seul compte les places. Un seul endroit decide du tarif.
  c_formule_gratuite  constant text    := 'gratuit';
  c_formule_payante   constant text    := 'starter';
  c_prix_payant       constant numeric := 39;
  c_max_util_gratuit  constant integer := 3;
  c_max_util_payant   constant integer := 10;
  c_modules_gratuit   constant text[]  := ARRAY['organisation'];
  c_modules_payant    constant text[]  := ARRAY['organisation', 'conges', 'pointage'];

  c_plan              text;
  c_prix_mensuel      numeric;
  c_max_utilisateurs  integer;
  c_modules           text[];

  v_slug      text;
  v_base_slug text;
  v_ent_id    uuid;
  v_module_id text;
  v_dept      jsonb;
  v_poste     jsonb;
  v_dept_id   uuid;
  v_suffixe   integer := 1;
BEGIN
  -- Aiguillage de la formule. Toute valeur autre que 'gratuit' -- y compris
  -- NULL, une chaine vide ou une valeur inventee -- donne l'offre payante.
  IF coalesce(trim(p_formule), '') = c_formule_gratuite THEN
    c_plan             := c_formule_gratuite;
    c_prix_mensuel     := 0;
    c_max_utilisateurs := c_max_util_gratuit;
    c_modules          := c_modules_gratuit;
  ELSE
    c_plan             := c_formule_payante;
    c_prix_mensuel     := c_prix_payant;
    c_max_utilisateurs := c_max_util_payant;
    c_modules          := c_modules_payant;
  END IF;

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

-- ---------------------------------------------------------------------
-- 3. Personne d'autre que les Edge Functions ne peut l'appeler
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_signup_create_entreprise_atomic(
  text, text, text, text, integer, jsonb, jsonb, uuid, text, text, text
) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- 4. Verification : une seule fonction, avec onze parametres.
-- ---------------------------------------------------------------------
SELECT
  p.oid::regprocedure                                   AS signature,
  pg_get_function_arguments(p.oid)                      AS parametres,
  (SELECT count(*) FROM pg_proc p2
     WHERE p2.proname = 'public_signup_create_entreprise_atomic') AS nb_versions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'public_signup_create_entreprise_atomic';
