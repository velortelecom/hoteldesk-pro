BEGIN;

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'direct',
  titre text,
  scope_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  scope_departement_id uuid REFERENCES public.departements(id) ON DELETE SET NULL,
  scope_equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.taches(id) ON DELETE SET NULL,
  annonce boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_type_check CHECK (type IN ('direct', 'equipe', 'departement', 'site', 'announcement', 'task'))
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_participants_unique UNIQUE (conversation_id, profile_id),
  CONSTRAINT conversation_participants_role_check CHECK (role IN ('owner', 'member', 'observer'))
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_entreprise_type ON public.conversations (entreprise_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_profile ON public.conversation_participants (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select ON public.conversations;
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.profile_id = auth.uid()
  )
);
CREATE POLICY conversations_insert ON public.conversations FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR created_by = auth.uid()
);
CREATE POLICY conversations_update ON public.conversations FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR created_by = auth.uid()
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
DROP POLICY IF EXISTS conversation_participants_insert ON public.conversation_participants;
DROP POLICY IF EXISTS conversation_participants_update ON public.conversation_participants;
DROP POLICY IF EXISTS conversation_participants_delete ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants FOR SELECT USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY conversation_participants_insert ON public.conversation_participants FOR INSERT WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY conversation_participants_update ON public.conversation_participants FOR UPDATE USING (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
) WITH CHECK (
  public.can_manage_own_entreprise(entreprise_id)
  OR profile_id = auth.uid()
);
CREATE POLICY conversation_participants_delete ON public.conversation_participants FOR DELETE USING (
  public.can_manage_own_entreprise(entreprise_id)
);

DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT USING (
  is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.profile_id = auth.uid()
  )
  OR (
    conversation_id IS NULL AND (
      expediteur_id = auth.uid()
      OR destinataire_id = auth.uid()
      OR ((get_my_role() = ANY (ARRAY['admin'::text, 'responsable'::text])) AND (entreprise_id = get_my_entreprise_id()))
    )
  )
);
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  is_super_admin()
  OR (
    expediteur_id = auth.uid()
    AND entreprise_id = get_my_entreprise_id()
    AND (
      conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id AND cp.profile_id = auth.uid()
      )
    )
  )
);
CREATE POLICY messages_delete ON public.messages FOR DELETE USING (
  is_super_admin() OR expediteur_id = auth.uid() OR ((get_my_role() = 'admin'::text) AND (entreprise_id = get_my_entreprise_id()))
);

COMMIT;