BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_create_entreprise_atomic(
  p_caller_id uuid,
  p_nom text,
  p_slug text,
  p_secteur text,
  p_plan text,
  p_actif boolean,
  p_prix_mensuel numeric,
  p_max_utilisateurs integer,
  p_email_contact text,
  p_telephone text,
  p_adresse text,
  p_modules jsonb,
  p_departements jsonb,
  p_postes jsonb,
  p_admin_user_id uuid DEFAULT NULL,
  p_admin_email text DEFAULT NULL,
  p_admin_prenom text DEFAULT NULL,
  p_admin_nom text DEFAULT NULL,
  p_admin_telephone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_ent_id uuid;
  v_site_slug text;
  v_module_id text;
  v_dept jsonb;
  v_poste jsonb;
  v_dept_id uuid;
BEGIN
  IF p_caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_caller_id
      AND COALESCE(p.is_super_admin, false)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF COALESCE(trim(p_nom), '') = '' THEN
    RAISE EXCEPTION 'missing_nom';
  END IF;

  v_slug := lower(regexp_replace(regexp_replace(trim(COALESCE(NULLIF(p_slug, ''), p_nom)), '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g'));
  IF v_slug = '' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;

  IF EXISTS (SELECT 1 FROM public.entreprises e WHERE e.slug = v_slug) THEN
    RAISE EXCEPTION 'entreprise_slug_exists';
  END IF;

  IF EXISTS (SELECT 1 FROM public.entreprises e WHERE lower(e.nom) = lower(trim(p_nom))) THEN
    RAISE EXCEPTION 'entreprise_name_exists';
  END IF;

  INSERT INTO public.entreprises (
    nom,
    slug,
    secteur,
    plan,
    actif,
    prix_mensuel,
    max_utilisateurs,
    email_contact,
    telephone,
    adresse
  )
  VALUES (
    trim(p_nom),
    v_slug,
    COALESCE(NULLIF(trim(p_secteur), ''), 'hotel'),
    COALESCE(NULLIF(trim(p_plan), ''), 'starter'),
    COALESCE(p_actif, true),
    COALESCE(p_prix_mensuel, 0),
    COALESCE(p_max_utilisateurs, 0),
    NULLIF(trim(COALESCE(p_email_contact, '')), ''),
    NULLIF(trim(COALESCE(p_telephone, '')), ''),
    NULLIF(trim(COALESCE(p_adresse, '')), '')
  )
  RETURNING id INTO v_ent_id;

  v_site_slug := v_slug || '-principal';
  BEGIN
    INSERT INTO public.sites (
      entreprise_id,
      nom,
      slug,
      adresse,
      ville,
      pays,
      actif
    ) VALUES (
      v_ent_id,
      trim(p_nom),
      v_site_slug,
      COALESCE(p_adresse, ''),
      '',
      'France',
      true
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.sites (
        entreprise_id,
        nom,
        slug,
        adresse,
        ville,
        pays,
        actif
      ) VALUES (
        v_ent_id,
        trim(p_nom),
        v_site_slug || '-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8),
        COALESCE(p_adresse, ''),
        '',
        'France',
        true
      );
  END;

  UPDATE public.entreprise_modules
  SET actif = false
  WHERE entreprise_id = v_ent_id;

  IF jsonb_typeof(COALESCE(p_modules, '[]'::jsonb)) = 'array' THEN
    FOR v_module_id IN
      SELECT DISTINCT jsonb_array_elements_text(COALESCE(p_modules, '[]'::jsonb))
    LOOP
      INSERT INTO public.entreprise_modules (entreprise_id, module_id, actif, activated_at)
      VALUES (v_ent_id, v_module_id, true, now())
      ON CONFLICT (entreprise_id, module_id)
      DO UPDATE SET actif = EXCLUDED.actif, activated_at = EXCLUDED.activated_at;
    END LOOP;
  END IF;

  IF jsonb_typeof(COALESCE(p_departements, '[]'::jsonb)) = 'array' THEN
    FOR v_dept IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_departements, '[]'::jsonb))
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.departements d
        WHERE d.entreprise_id = v_ent_id
          AND d.code = trim(COALESCE(v_dept->>'code', ''))
      ) THEN
        UPDATE public.departements
        SET
          nom = COALESCE(NULLIF(trim(v_dept->>'nom'), ''), initcap(replace(COALESCE(v_dept->>'code', ''), '_', ' '))),
          couleur = COALESCE(NULLIF(trim(v_dept->>'couleur'), ''), '#6B7280'),
          actif = true
        WHERE entreprise_id = v_ent_id
          AND code = trim(COALESCE(v_dept->>'code', ''));
      ELSE
        INSERT INTO public.departements (entreprise_id, nom, code, couleur, actif)
        VALUES (
          v_ent_id,
          COALESCE(NULLIF(trim(v_dept->>'nom'), ''), initcap(replace(COALESCE(v_dept->>'code', ''), '_', ' '))),
          trim(COALESCE(v_dept->>'code', '')),
          COALESCE(NULLIF(trim(v_dept->>'couleur'), ''), '#6B7280'),
          true
        );
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(COALESCE(p_postes, '[]'::jsonb)) = 'array' THEN
    FOR v_poste IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_postes, '[]'::jsonb))
    LOOP
      IF COALESCE((v_poste->>'selectionne')::boolean, false) IS NOT TRUE THEN
        CONTINUE;
      END IF;

      v_dept_id := NULL;
      IF NULLIF(trim(COALESCE(v_poste->>'dept', '')), '') IS NOT NULL THEN
        SELECT d.id
        INTO v_dept_id
        FROM public.departements d
        WHERE d.entreprise_id = v_ent_id
          AND d.code = trim(v_poste->>'dept')
        LIMIT 1;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.postes p
        WHERE p.entreprise_id = v_ent_id
          AND p.slug = trim(COALESCE(v_poste->>'slug', ''))
      ) THEN
        UPDATE public.postes
        SET
          nom = COALESCE(NULLIF(trim(v_poste->>'nom'), ''), 'Poste'),
          departement_id = v_dept_id,
          niveau = COALESCE(NULLIF((v_poste->>'niveau')::int, 0), 3),
          actif = true
        WHERE entreprise_id = v_ent_id
          AND slug = trim(COALESCE(v_poste->>'slug', ''));
      ELSE
        INSERT INTO public.postes (entreprise_id, nom, slug, departement_id, niveau, role_systeme, actif)
        VALUES (
          v_ent_id,
          COALESCE(NULLIF(trim(v_poste->>'nom'), ''), 'Poste'),
          trim(COALESCE(v_poste->>'slug', '')),
          v_dept_id,
          COALESCE(NULLIF((v_poste->>'niveau')::int, 0), 3),
          'employe',
          true
        );
      END IF;
    END LOOP;
  END IF;

  IF p_admin_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      prenom,
      nom,
      role,
      entreprise_id,
      telephone,
      actif,
      is_super_admin
    )
    VALUES (
      p_admin_user_id,
      COALESCE(NULLIF(trim(p_admin_prenom), ''), 'Admin'),
      COALESCE(NULLIF(trim(p_admin_nom), ''), trim(p_nom)),
      'admin',
      v_ent_id,
      NULLIF(trim(COALESCE(p_admin_telephone, '')), ''),
      true,
      false
    )
    ON CONFLICT (id)
    DO UPDATE SET
      prenom = EXCLUDED.prenom,
      nom = EXCLUDED.nom,
      role = 'admin',
      entreprise_id = v_ent_id,
      telephone = EXCLUDED.telephone,
      actif = true,
      is_super_admin = false;
  END IF;

  RETURN jsonb_build_object('success', true, 'entreprise_id', v_ent_id, 'slug', v_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_create_entreprise_atomic(
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  numeric,
  integer,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  uuid,
  text,
  text,
  text,
  text
) TO authenticated;

COMMIT;
