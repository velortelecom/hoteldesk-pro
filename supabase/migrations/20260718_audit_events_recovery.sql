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

COMMIT;
