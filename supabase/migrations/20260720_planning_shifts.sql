BEGIN;

CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  employe_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  departement_id uuid REFERENCES public.departements(id) ON DELETE SET NULL,
  date_shift date NOT NULL,
  heure_debut time NOT NULL,
  heure_fin time NOT NULL,
  pause_minutes integer NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon',
  type_shift text NOT NULL DEFAULT 'travail',
  notes text,
  recurrence_rule jsonb,
  remplacement_de_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shifts_time_check CHECK (heure_fin > heure_debut),
  CONSTRAINT shifts_pause_check CHECK (pause_minutes >= 0 AND pause_minutes <= 720),
  CONSTRAINT shifts_status_check CHECK (statut IN ('brouillon', 'publie', 'annule')),
  CONSTRAINT shifts_type_check CHECK (type_shift IN ('travail', 'reunion', 'formation', 'intervention', 'astreinte'))
);

CREATE TABLE IF NOT EXISTS public.shift_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_events_action_check CHECK (action IN ('insert', 'update', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_shifts_entreprise_date ON public.shifts (entreprise_id, date_shift);
CREATE INDEX IF NOT EXISTS idx_shifts_employe_date ON public.shifts (employe_id, date_shift);
CREATE INDEX IF NOT EXISTS idx_shifts_site_date ON public.shifts (site_id, date_shift);
CREATE INDEX IF NOT EXISTS idx_shifts_departement_date ON public.shifts (departement_id, date_shift);
CREATE INDEX IF NOT EXISTS idx_shifts_equipe_date ON public.shifts (equipe_id, date_shift);
CREATE INDEX IF NOT EXISTS idx_shift_events_shift_id ON public.shift_events (shift_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at
BEFORE UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.log_shift_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.shift_events (shift_id, entreprise_id, action, actor_id, new_data)
    VALUES (NEW.id, NEW.entreprise_id, 'insert', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.shift_events (shift_id, entreprise_id, action, actor_id, old_data, new_data)
    VALUES (NEW.id, NEW.entreprise_id, 'update', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.shift_events (shift_id, entreprise_id, action, actor_id, old_data)
    VALUES (OLD.id, OLD.entreprise_id, 'delete', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_events ON public.shifts;
CREATE TRIGGER trg_shift_events
AFTER INSERT OR UPDATE OR DELETE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.log_shift_event();

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shifts_select ON public.shifts;
DROP POLICY IF EXISTS shifts_insert ON public.shifts;
DROP POLICY IF EXISTS shifts_update ON public.shifts;
DROP POLICY IF EXISTS shifts_delete ON public.shifts;
CREATE POLICY shifts_select ON public.shifts FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR employe_id = auth.uid()
);
CREATE POLICY shifts_insert ON public.shifts FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY shifts_update ON public.shifts FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
);
CREATE POLICY shifts_delete ON public.shifts FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS shift_events_select ON public.shift_events;
CREATE POLICY shift_events_select ON public.shift_events FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
);

COMMIT;