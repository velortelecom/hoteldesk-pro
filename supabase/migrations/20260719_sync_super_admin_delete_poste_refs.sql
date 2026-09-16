BEGIN;

CREATE OR REPLACE FUNCTION public.safe_nullify_if_column_exists(
  p_schema text,
  p_table text,
  p_column text,
  p_filter_column text,
  p_value uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = p_column
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = p_filter_column
  ) THEN
    EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1', p_schema, p_table, p_column, p_filter_column)
    USING p_value;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.supprimer_entreprise_complete(p_entreprise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller public.profiles%ROWTYPE;
  v_profile_ids uuid[];
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT * INTO v_caller
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller_profile_missing';
  END IF;

  IF NOT COALESCE(v_caller.is_super_admin, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE entreprise_id = p_entreprise_id
      AND COALESCE(is_super_admin, false)
  ) THEN
    RAISE EXCEPTION 'protected_super_admin_linked';
  END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  INTO v_profile_ids
  FROM public.profiles
  WHERE entreprise_id = p_entreprise_id;

  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'employe_departements', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'pointages', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'conges', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'soldes_conges', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'messages', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'rappels', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'taches', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'handovers', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_likes', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_items', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'maintenance_tickets', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'chambres', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'abonnements', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'entreprise_modules', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'entreprise_parametres_pointage', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'sites', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_delete_if_column_exists('public', 'departements', 'entreprise_id', p_entreprise_id);

  PERFORM public.safe_nullify_if_column_exists('public', 'profiles', 'poste_id', 'entreprise_id', p_entreprise_id);
  PERFORM public.safe_nullify_if_column_exists('public', 'profiles', 'poste_secondaire_id', 'entreprise_id', p_entreprise_id);

  DELETE FROM public.profiles
  WHERE entreprise_id = p_entreprise_id;

  PERFORM public.safe_delete_if_column_exists('public', 'postes', 'entreprise_id', p_entreprise_id);

  IF v_profile_ids IS NOT NULL THEN
    FOREACH v_profile_id IN ARRAY v_profile_ids LOOP
      DELETE FROM auth.users WHERE id = v_profile_id;
    END LOOP;
  END IF;

  DELETE FROM public.entreprises
  WHERE id = p_entreprise_id;

  RETURN jsonb_build_object('success', true, 'entreprise_id', p_entreprise_id, 'users_deleted', COALESCE(array_length(v_profile_ids, 1), 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.safe_nullify_if_column_exists(text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_entreprise_complete(uuid) TO authenticated;

COMMIT;