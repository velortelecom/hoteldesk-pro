BEGIN;

CREATE TABLE IF NOT EXISTS public.super_admin_assistance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  reason text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes >= 5 AND duration_minutes <= 240),
  readonly_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sa_assistance_created_at ON public.super_admin_assistance_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_assistance_actor ON public.super_admin_assistance_sessions(super_admin_profile_id);
CREATE INDEX IF NOT EXISTS idx_sa_assistance_entreprise ON public.super_admin_assistance_sessions(entreprise_id);

ALTER TABLE public.super_admin_assistance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_assistance_select ON public.super_admin_assistance_sessions;
DROP POLICY IF EXISTS sa_assistance_insert ON public.super_admin_assistance_sessions;
DROP POLICY IF EXISTS sa_assistance_update ON public.super_admin_assistance_sessions;
DROP POLICY IF EXISTS sa_assistance_delete ON public.super_admin_assistance_sessions;

CREATE POLICY sa_assistance_select ON public.super_admin_assistance_sessions
FOR SELECT USING (public.is_super_admin());

CREATE POLICY sa_assistance_insert ON public.super_admin_assistance_sessions
FOR INSERT WITH CHECK (
  public.is_super_admin()
  AND super_admin_profile_id = auth.uid()
);

CREATE POLICY sa_assistance_update ON public.super_admin_assistance_sessions
FOR UPDATE USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY sa_assistance_delete ON public.super_admin_assistance_sessions
FOR DELETE USING (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_assistance_sessions TO authenticated;

CREATE TABLE IF NOT EXISTS public.global_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_settings_select ON public.global_settings;
DROP POLICY IF EXISTS global_settings_insert ON public.global_settings;
DROP POLICY IF EXISTS global_settings_update ON public.global_settings;
DROP POLICY IF EXISTS global_settings_delete ON public.global_settings;

CREATE POLICY global_settings_select ON public.global_settings
FOR SELECT USING (public.is_super_admin());

CREATE POLICY global_settings_insert ON public.global_settings
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY global_settings_update ON public.global_settings
FOR UPDATE USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY global_settings_delete ON public.global_settings
FOR DELETE USING (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_settings TO authenticated;

INSERT INTO public.global_settings(key, value, description)
VALUES
  ('brand_name', '"Velor One"'::jsonb, 'Nom de marque global'),
  ('support_email', '"support@velor.one"'::jsonb, 'Email support plateforme'),
  ('ui_theme', '{"primary":"#1D4ED8","accent":"#0EA5E9"}'::jsonb, 'Theme visuel global')
ON CONFLICT (key) DO NOTHING;

COMMIT;
