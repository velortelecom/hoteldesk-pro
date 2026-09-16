BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acteur_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acteur_email text,
  entreprise_id uuid REFERENCES public.entreprises(id) ON DELETE SET NULL,
  action text NOT NULL,
  type_cible text NOT NULL,
  cible_id uuid,
  description text NOT NULL,
  metadonnees jsonb NOT NULL DEFAULT '{}'::jsonb,
  adresse_ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_acteur_profile_created_at ON public.audit_events (acteur_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entreprise_created_at ON public.audit_events (entreprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_created_at ON public.audit_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events (created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_select_super_admin ON public.audit_events;
DROP POLICY IF EXISTS audit_events_select_admin_entreprise ON public.audit_events;
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
DROP POLICY IF EXISTS audit_events_update ON public.audit_events;
DROP POLICY IF EXISTS audit_events_delete ON public.audit_events;

CREATE POLICY audit_events_select_super_admin ON public.audit_events
FOR SELECT USING (public.is_super_admin());

CREATE POLICY audit_events_select_admin_entreprise ON public.audit_events
FOR SELECT USING (
  public.get_my_role() IN ('admin', 'responsable')
  AND entreprise_id = public.get_my_entreprise_id()
);

CREATE OR REPLACE FUNCTION public.sanitize_audit_metadata(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  key_name text;
  value_item jsonb;
  blocked_keys text[] := ARRAY['password', 'temp_password', 'token', 'access_token', 'refresh_token', 'secret', 'api_key', 'private_key', 'service_role', 'authorization', 'jwt'];
BEGIN
  IF input IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF jsonb_typeof(input) <> 'object' THEN
    RETURN input;
  END IF;

  FOR key_name, value_item IN
    SELECT key, value
    FROM jsonb_each(input)
  LOOP
    IF lower(key_name) = ANY (blocked_keys) THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(value_item) = 'object' THEN
      result := result || jsonb_build_object(key_name, public.sanitize_audit_metadata(value_item));
    ELSIF jsonb_typeof(value_item) = 'array' THEN
      result := result || jsonb_build_object(
        key_name,
        (
          SELECT COALESCE(jsonb_agg(public.sanitize_audit_metadata(elem)), '[]'::jsonb)
          FROM jsonb_array_elements(value_item) AS elem
        )
      );
    ELSE
      result := result || jsonb_build_object(key_name, value_item);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_audit_event(
  acteur_profile_id uuid,
  acteur_email text,
  entreprise_id uuid,
  action text,
  type_cible text,
  cible_id uuid,
  description text,
  metadonnees jsonb,
  adresse_ip inet,
  user_agent text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_events (
    acteur_profile_id,
    acteur_email,
    entreprise_id,
    action,
    type_cible,
    cible_id,
    description,
    metadonnees,
    adresse_ip,
    user_agent
  ) VALUES (
    acteur_profile_id,
    acteur_email,
    entreprise_id,
    action,
    type_cible,
    cible_id,
    description,
    COALESCE(public.sanitize_audit_metadata(metadonnees), '{}'::jsonb),
    adresse_ip,
    user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_audit_event(uuid, text, uuid, text, text, uuid, text, jsonb, inet, text) TO service_role;

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := auth.uid();
  v_actor_email text := nullif(auth.jwt() ->> 'email', '');
  v_entreprise_id uuid;
  v_cible_id uuid;
  v_action text;
  v_description text;
  v_type_cible text;
  v_metadata jsonb := '{}'::jsonb;
  v_old_actif boolean;
  v_new_actif boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cible_id := OLD.id;
    v_entreprise_id := OLD.entreprise_id;
  ELSE
    v_cible_id := NEW.id;
    v_entreprise_id := NEW.entreprise_id;
  END IF;

  IF TG_TABLE_NAME = 'entreprises' THEN
    v_type_cible := 'entreprise';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_entreprise';
      v_description := 'Création entreprise';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_entreprise';
      v_description := 'Suppression entreprise';
    ELSE
      v_old_actif := COALESCE(OLD.actif, true);
      v_new_actif := COALESCE(NEW.actif, true);
      IF v_old_actif IS DISTINCT FROM v_new_actif THEN
        v_action := CASE WHEN v_new_actif THEN 'reactivation_entreprise' ELSE 'suspension_entreprise' END;
        v_description := CASE WHEN v_new_actif THEN 'Réactivation entreprise' ELSE 'Suspension entreprise' END;
      ELSE
        v_action := 'modification_entreprise';
        v_description := 'Modification entreprise';
      END IF;
    END IF;
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  ELSIF TG_TABLE_NAME = 'entreprise_modules' THEN
    v_type_cible := 'module';
    IF TG_OP = 'INSERT' THEN
      v_action := CASE WHEN COALESCE(NEW.actif, false) THEN 'activation_module' ELSE 'desactivation_module' END;
      v_description := CASE WHEN COALESCE(NEW.actif, false) THEN 'Activation module' ELSE 'Désactivation module' END;
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'desactivation_module';
      v_description := 'Désactivation module';
    ELSE
      v_action := CASE WHEN COALESCE(NEW.actif, false) THEN 'activation_module' ELSE 'desactivation_module' END;
      v_description := CASE WHEN COALESCE(NEW.actif, false) THEN 'Activation module' ELSE 'Désactivation module' END;
    END IF;
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'module_id', COALESCE(NEW.module_id, OLD.module_id), 'actif', COALESCE(NEW.actif, OLD.actif));
  ELSIF TG_TABLE_NAME = 'sites' THEN
    v_type_cible := 'site';
    IF TG_OP = 'INSERT' THEN
      v_action := 'creation_site';
      v_description := 'Création site';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'suppression_site';
      v_description := 'Suppression site';
    ELSE
      v_action := 'modification_site';
      v_description := 'Modification site';
    END IF;
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  ELSIF TG_TABLE_NAME = 'departements' THEN
    v_type_cible := 'departement';
    v_action := lower(TG_OP) || '_departement';
    v_description := initcap(lower(TG_OP)) || ' département';
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  ELSIF TG_TABLE_NAME = 'postes' THEN
    v_type_cible := 'poste';
    v_action := lower(TG_OP) || '_poste';
    v_description := initcap(lower(TG_OP)) || ' poste';
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  ELSIF TG_TABLE_NAME = 'entreprise_parametres_pointage' THEN
    v_type_cible := 'parametres_pointage';
    v_action := 'modification_parametres_critiques';
    v_description := 'Modification paramètres critiques';
    v_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP);
  ELSE
    RETURN NULL;
  END IF;

  PERFORM public.record_audit_event(
    v_actor_profile_id,
    v_actor_email,
    v_entreprise_id,
    v_action,
    v_type_cible,
    v_cible_id,
    v_description,
    v_metadata,
    null,
    null
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_entreprises ON public.entreprises;
CREATE TRIGGER trg_audit_entreprises
AFTER INSERT OR UPDATE OR DELETE ON public.entreprises
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_entreprise_modules ON public.entreprise_modules;
CREATE TRIGGER trg_audit_entreprise_modules
AFTER INSERT OR UPDATE OR DELETE ON public.entreprise_modules
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_sites ON public.sites;
CREATE TRIGGER trg_audit_sites
AFTER INSERT OR UPDATE OR DELETE ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_departements ON public.departements;
CREATE TRIGGER trg_audit_departements
AFTER INSERT OR UPDATE OR DELETE ON public.departements
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_postes ON public.postes;
CREATE TRIGGER trg_audit_postes
AFTER INSERT OR UPDATE OR DELETE ON public.postes
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS trg_audit_parametres_pointage ON public.entreprise_parametres_pointage;
CREATE TRIGGER trg_audit_parametres_pointage
AFTER INSERT OR UPDATE OR DELETE ON public.entreprise_parametres_pointage
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

COMMIT;
