-- Group chats, members, in-app notifications, group invite codes

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS chat_type TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_unique_pair;
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_users_ordered;

CREATE UNIQUE INDEX IF NOT EXISTS chats_direct_pair_unique
  ON public.chats (user_a, user_b)
  WHERE chat_type = 'direct';

CREATE UNIQUE INDEX IF NOT EXISTS chats_invite_code_unique
  ON public.chats (invite_code)
  WHERE invite_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_members (
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_profile ON public.chat_members(profile_id);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient
  ON public.app_notifications(recipient_id, created_at DESC);

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "chat_members_delete" ON public.chat_members
  FOR DELETE TO authenticated, anon USING (true);

CREATE POLICY "app_notifications_select" ON public.app_notifications
  FOR SELECT TO authenticated, anon
  USING (recipient_id = public.my_profile_id() OR true);

CREATE POLICY "app_notifications_insert" ON public.app_notifications
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "app_notifications_update" ON public.app_notifications
  FOR UPDATE TO authenticated, anon
  USING (recipient_id = public.my_profile_id() OR true);

ALTER TABLE public.chat_members REPLICA IDENTITY FULL;
ALTER TABLE public.app_notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;

-- Extend member check for group chats
CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = p_chat_id
      AND (
        (
          COALESCE(c.chat_type, 'direct') = 'direct'
          AND (c.user_a = public.my_profile_id() OR c.user_b = public.my_profile_id())
        )
        OR EXISTS (
          SELECT 1 FROM public.chat_members m
          WHERE m.chat_id = p_chat_id AND m.profile_id = public.my_profile_id()
        )
      )
  );
$$;
