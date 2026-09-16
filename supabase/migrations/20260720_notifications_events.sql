BEGIN;

CREATE TABLE IF NOT EXISTS public.business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  resource_type text,
  resource_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  content text,
  link text,
  read_at timestamptz,
  resource_type text,
  resource_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_events_entreprise_created_at ON public.business_events (entreprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_events_type ON public.business_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entreprise_created_at ON public.notifications (entreprise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (recipient_id, read_at);

ALTER TABLE public.business_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_events_select ON public.business_events;
CREATE POLICY business_events_select ON public.business_events FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR actor_id = auth.uid()
);

DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR recipient_id = auth.uid()
);
CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR actor_id = auth.uid()
);
CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR recipient_id = auth.uid()
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR recipient_id = auth.uid()
);

COMMIT;