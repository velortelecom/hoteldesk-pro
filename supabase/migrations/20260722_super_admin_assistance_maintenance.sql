BEGIN;

DROP TRIGGER IF EXISTS trg_global_settings_updated_at ON public.global_settings;
CREATE TRIGGER trg_global_settings_updated_at
BEFORE UPDATE ON public.global_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.super_admin_close_expired_assistance_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.super_admin_assistance_sessions
  SET closed_at = now()
  WHERE closed_at IS NULL
    AND expires_at <= now();

  GET DIAGNOSTICS v_closed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'closed_count', v_closed_count,
    'closed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_close_expired_assistance_sessions() TO authenticated;

COMMIT;
