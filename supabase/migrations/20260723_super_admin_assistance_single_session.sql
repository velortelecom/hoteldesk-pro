BEGIN;

-- Enforce a single open assistance session at any time to avoid race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sa_assistance_single_open
ON public.super_admin_assistance_sessions ((1))
WHERE closed_at IS NULL;

COMMIT;
