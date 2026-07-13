-- Fix: delete auth.users FIRST in supprimer_membre_complet so the cascade
-- removes the profile row automatically, preventing the race condition
-- where the profile is gone but the Auth session is still active.
-- Previously: profile deleted first, then auth.users. If auth.users deletion
-- failed, the user had a valid session but no profile, causing
-- rappels_cree_par_fkey violations.

CREATE OR REPLACE FUNCTION public.supprimer_membre_complet(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller public.profiles%ROWTYPE;
  v_target public.profiles%ROWTYPE;
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

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_profile_missing';
  END IF;

  IF COALESCE(v_target.is_super_admin, false) THEN
    RAISE EXCEPTION 'protected_super_admin';
  END IF;

  IF NOT COALESCE(v_caller.is_super_admin, false) THEN
    IF v_caller.role NOT IN ('admin', 'responsable') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;

    IF v_target.entreprise_id IS DISTINCT FROM v_caller.entreprise_id THEN
      RAISE EXCEPTION 'forbidden_cross_enterprise';
    END IF;
  END IF;

  -- Step 1: delete tables that may NOT have a FK cascade to profiles.
  -- Tables WITH ON DELETE CASCADE to profiles (rappels.cree_par,
  -- conges.employe_id, messages.expediteur_id, taches.cree_par, etc.)
  -- are cleaned automatically in step 2.
  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'credentials_temporaires', 'user_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'employe_departements', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'soldes_conges', 'employe_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'handovers', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_likes', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'feed_items', 'profile_id', p_user_id);
  PERFORM public.safe_delete_if_column_exists('public', 'maintenance_tickets', 'profile_id', p_user_id);

  -- Step 2: delete auth.users FIRST.
  -- The FK  profiles(id) REFERENCES auth.users ON DELETE CASCADE  removes
  -- the profile row automatically. The profile FK cascades in turn remove
  -- rappels, conges, messages, pointages rows. This also invalidates all
  -- active sessions for this user, closing the race condition window.
  DELETE FROM auth.users
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'entreprise_id', v_target.entreprise_id);
END;
$$;
