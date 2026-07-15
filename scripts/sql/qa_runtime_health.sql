DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%chef_equipe%'
      AND pg_get_constraintdef(c.oid) ILIKE '%super_admin%'
  ) THEN
    RAISE EXCEPTION 'profiles role constraint is missing chef_equipe or super_admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.modules_catalogue
    WHERE id = 'pointage'
  ) THEN
    RAISE EXCEPTION 'modules_catalogue is missing pointage module';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'super_admin_create_entreprise_atomic'
  ) THEN
    RAISE EXCEPTION 'public.super_admin_create_entreprise_atomic is missing';
  END IF;
END
$$;

SELECT 'qa_runtime_health_ok' AS status;
