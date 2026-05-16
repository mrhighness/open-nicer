-- =============================================================================
-- CATCH-UP MIGRATION — safe to run multiple times (idempotent)
-- =============================================================================
-- Applies schema/features from migrations that may not be on your remote DB yet.
-- Requires base tables from 20260416205532 (profiles, chats, messages, reactions).
--
-- HOW TO RUN (pick one):
--   A) Supabase CLI (recommended):
--        npx supabase login
--        npx supabase link --project-ref YOUR_PROJECT_REF
--        npx supabase db push
--
--   B) Supabase Dashboard → SQL Editor → paste this entire file → Run
--
--   C) psql:
--        psql "$DATABASE_URL" -f supabase/migrations/20260519120000_catch_up_all_pending.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Profile privacy & auth (20260515180000, 20260515210000)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_incoming_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS claim_token UUID DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.profile_is_visible(target_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    target_id = public.my_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = target_id AND COALESCE(p.discoverable, true) = true
    )
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE (c.user_a = target_id OR c.user_b = target_id)
        AND (c.user_a = public.my_profile_id() OR c.user_b = public.my_profile_id())
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.profile_id = target_id
        AND m.chat_id IN (
          SELECT cm.chat_id FROM public.chat_members cm
          WHERE cm.profile_id = public.my_profile_id()
        )
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. Message attachments + storage bucket (20260417010356)
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS attachment_duration numeric;

ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Constraints (20260515210000)
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_max_len;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_max_len CHECK (char_length(content) <= 10000);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_len CHECK (char_length(username) BETWEEN 2 AND 32);

ALTER TABLE public.reactions DROP CONSTRAINT IF EXISTS reactions_emoji_len;
ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 8);

-- -----------------------------------------------------------------------------
-- 4. Status updates (20260516120000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_status_updates_user_created ON public.status_updates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_updates_expires ON public.status_updates(expires_at);

CREATE TABLE IF NOT EXISTS public.status_views (
  status_id UUID NOT NULL REFERENCES public.status_updates(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_status_views_viewer ON public.status_views(viewer_id);

ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. Blocks & mutes (20260516160000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);

CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id),
  CONSTRAINT chat_mutes_no_self CHECK (user_id <> peer_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_mutes_user ON public.chat_mutes(user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 6. Groups (20260517120000)
-- -----------------------------------------------------------------------------
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS chat_type TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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

-- -----------------------------------------------------------------------------
-- 7. Profile invite RPC (20260516140000)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_for_invite(target_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  status TEXT,
  allow_incoming_messages BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.status,
    COALESCE(p.allow_incoming_messages, true)
  FROM public.profiles p
  WHERE p.id = target_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_for_invite(UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. RLS — authenticated policies (20260515210000 + groups + group avatar)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone read profiles" ON public.profiles;
DROP POLICY IF EXISTS "anyone insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "anyone update profiles" ON public.profiles;
DROP POLICY IF EXISTS "anyone read chats" ON public.chats;
DROP POLICY IF EXISTS "anyone insert chats" ON public.chats;
DROP POLICY IF EXISTS "anyone delete chats" ON public.chats;
DROP POLICY IF EXISTS "anyone read messages" ON public.messages;
DROP POLICY IF EXISTS "anyone insert messages" ON public.messages;
DROP POLICY IF EXISTS "anyone update messages" ON public.messages;
DROP POLICY IF EXISTS "anyone delete messages" ON public.messages;
DROP POLICY IF EXISTS "anyone read reactions" ON public.reactions;
DROP POLICY IF EXISTS "anyone insert reactions" ON public.reactions;
DROP POLICY IF EXISTS "anyone delete reactions" ON public.reactions;

DROP POLICY IF EXISTS "profiles_select_visible" ON public.profiles;
CREATE POLICY "profiles_select_visible" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.profile_is_visible(id));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_claim_once" ON public.profiles;
CREATE POLICY "profiles_claim_once" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id IS NULL)
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "chats_select_member" ON public.chats;
CREATE POLICY "chats_select_member" ON public.chats
  FOR SELECT TO authenticated
  USING (
    user_a = public.my_profile_id()
    OR user_b = public.my_profile_id()
    OR public.is_chat_member(id)
  );

DROP POLICY IF EXISTS "chats_insert_participant" ON public.chats;
CREATE POLICY "chats_insert_participant" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_a = public.my_profile_id() OR user_b = public.my_profile_id())
    AND (
      COALESCE(chat_type, 'direct') = 'group'
      OR (user_a < user_b AND COALESCE(chat_type, 'direct') = 'direct')
    )
  );

DROP POLICY IF EXISTS "chats_update_group_admin" ON public.chats;
CREATE POLICY "chats_update_group_admin" ON public.chats
  FOR UPDATE TO authenticated
  USING (
    COALESCE(chat_type, 'direct') = 'group'
    AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.chat_id = id
        AND m.profile_id = public.my_profile_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    COALESCE(chat_type, 'direct') = 'group'
    AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.chat_id = id
        AND m.profile_id = public.my_profile_id()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "messages_select_member" ON public.messages;
CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.my_profile_id()
    AND public.is_chat_member(chat_id)
  );

DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = public.my_profile_id())
  WITH CHECK (sender_id = public.my_profile_id());

DROP POLICY IF EXISTS "reactions_select_member" ON public.reactions;
CREATE POLICY "reactions_select_member" ON public.reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_chat_member(m.chat_id)
    )
  );

DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.my_profile_id());

DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own" ON public.reactions
  FOR DELETE TO authenticated
  USING (user_id = public.my_profile_id());

-- Group members & notifications
DROP POLICY IF EXISTS "chat_members_select" ON public.chat_members;
CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
CREATE POLICY "chat_members_insert" ON public.chat_members
  FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "chat_members_delete" ON public.chat_members;
CREATE POLICY "chat_members_delete" ON public.chat_members
  FOR DELETE TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "app_notifications_select" ON public.app_notifications;
CREATE POLICY "app_notifications_select" ON public.app_notifications
  FOR SELECT TO authenticated, anon
  USING (recipient_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "app_notifications_insert" ON public.app_notifications;
CREATE POLICY "app_notifications_insert" ON public.app_notifications
  FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "app_notifications_update" ON public.app_notifications;
CREATE POLICY "app_notifications_update" ON public.app_notifications
  FOR UPDATE TO authenticated, anon
  USING (recipient_id = public.my_profile_id() OR true);

-- Status policies
DROP POLICY IF EXISTS "status_updates_select_visible" ON public.status_updates;
CREATE POLICY "status_updates_select_visible" ON public.status_updates
  FOR SELECT TO authenticated
  USING (expires_at > now() AND public.profile_is_visible(user_id));

DROP POLICY IF EXISTS "status_updates_insert_own" ON public.status_updates;
CREATE POLICY "status_updates_insert_own" ON public.status_updates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.my_profile_id());

DROP POLICY IF EXISTS "status_updates_delete_own" ON public.status_updates;
CREATE POLICY "status_updates_delete_own" ON public.status_updates
  FOR DELETE TO authenticated
  USING (user_id = public.my_profile_id());

DROP POLICY IF EXISTS "status_updates_select_legacy" ON public.status_updates;
CREATE POLICY "status_updates_select_legacy" ON public.status_updates
  FOR SELECT TO anon, authenticated
  USING (expires_at > now());

DROP POLICY IF EXISTS "status_updates_insert_legacy" ON public.status_updates;
CREATE POLICY "status_updates_insert_legacy" ON public.status_updates
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "status_updates_delete_legacy" ON public.status_updates;
CREATE POLICY "status_updates_delete_legacy" ON public.status_updates
  FOR DELETE TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "status_views_select" ON public.status_views;
CREATE POLICY "status_views_select" ON public.status_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = public.my_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.status_updates s
      WHERE s.id = status_id AND s.user_id = public.my_profile_id()
    )
  );

DROP POLICY IF EXISTS "status_views_insert" ON public.status_views;
CREATE POLICY "status_views_insert" ON public.status_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = public.my_profile_id());

DROP POLICY IF EXISTS "status_views_all_legacy" ON public.status_views;
CREATE POLICY "status_views_all_legacy" ON public.status_views
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Blocks & mutes
DROP POLICY IF EXISTS "user_blocks_select" ON public.user_blocks;
CREATE POLICY "user_blocks_select" ON public.user_blocks
  FOR SELECT TO authenticated, anon
  USING (blocker_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "user_blocks_insert" ON public.user_blocks;
CREATE POLICY "user_blocks_insert" ON public.user_blocks
  FOR INSERT TO authenticated, anon
  WITH CHECK (blocker_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "user_blocks_delete" ON public.user_blocks;
CREATE POLICY "user_blocks_delete" ON public.user_blocks
  FOR DELETE TO authenticated, anon
  USING (blocker_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "chat_mutes_select" ON public.chat_mutes;
CREATE POLICY "chat_mutes_select" ON public.chat_mutes
  FOR SELECT TO authenticated, anon
  USING (user_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "chat_mutes_insert" ON public.chat_mutes;
CREATE POLICY "chat_mutes_insert" ON public.chat_mutes
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id = public.my_profile_id() OR true);

DROP POLICY IF EXISTS "chat_mutes_delete" ON public.chat_mutes;
CREATE POLICY "chat_mutes_delete" ON public.chat_mutes
  FOR DELETE TO authenticated, anon
  USING (user_id = public.my_profile_id() OR true);

-- Anon fallback (20260516150000) — demo / local dev without auth
DROP POLICY IF EXISTS "profiles_legacy_anon" ON public.profiles;
CREATE POLICY "profiles_legacy_anon" ON public.profiles
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chats_legacy_anon" ON public.chats;
CREATE POLICY "chats_legacy_anon" ON public.chats
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_legacy_anon" ON public.messages;
CREATE POLICY "messages_legacy_anon" ON public.messages
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reactions_legacy_anon" ON public.reactions;
CREATE POLICY "reactions_legacy_anon" ON public.reactions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 9. Storage policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anyone read attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone update attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone delete attachments" ON storage.objects;

DROP POLICY IF EXISTS "storage_read_attachments" ON storage.objects;
CREATE POLICY "storage_read_attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      name LIKE 'avatars/%'
      OR public.is_chat_member(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "storage_insert_own_paths" ON storage.objects;
CREATE POLICY "storage_insert_own_paths" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      (
        (storage.foldername(name))[2] = public.my_profile_id()::text
        AND public.is_chat_member(((storage.foldername(name))[1])::uuid)
      )
      OR name LIKE ('avatars/' || public.my_profile_id()::text || '/%')
    )
  );

DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
CREATE POLICY "storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[2] = public.my_profile_id()::text
      OR name LIKE ('avatars/' || public.my_profile_id()::text || '/%')
    )
  );

DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;
CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[2] = public.my_profile_id()::text
      OR name LIKE ('avatars/' || public.my_profile_id()::text || '/%')
    )
  );

-- Group profile photos: avatars/groups/{chatId}/...
DROP POLICY IF EXISTS "storage_group_avatar_write" ON storage.objects;
CREATE POLICY "storage_group_avatar_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = 'groups'
    AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.chat_id = ((storage.foldername(name))[3])::uuid
        AND m.profile_id = public.my_profile_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = 'groups'
    AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.chat_id = ((storage.foldername(name))[3])::uuid
        AND m.profile_id = public.my_profile_id()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "storage_insert_status" ON storage.objects;
CREATE POLICY "storage_insert_status" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'status'
    AND (storage.foldername(name))[2] = public.my_profile_id()::text
  );

DROP POLICY IF EXISTS "storage_read_status" ON storage.objects;
CREATE POLICY "storage_read_status" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'status'
    AND public.profile_is_visible(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "storage_status_legacy" ON storage.objects;
CREATE POLICY "storage_status_legacy" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'status')
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'status');

DROP POLICY IF EXISTS "storage_legacy_anon" ON storage.objects;
CREATE POLICY "storage_legacy_anon" ON storage.objects
  FOR ALL TO anon
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

-- -----------------------------------------------------------------------------
-- 10. Realtime (ignore if already subscribed)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.status_updates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.chat_members REPLICA IDENTITY FULL;
ALTER TABLE public.app_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.status_updates REPLICA IDENTITY FULL;

-- Inbox performance RPCs (also in 20260520120000_inbox_performance.sql)
CREATE OR REPLACE FUNCTION public.get_last_messages_for_chats(p_chat_ids uuid[])
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.chat_id) m.*
  FROM public.messages m
  WHERE m.chat_id = ANY(p_chat_ids)
    AND NOT m.is_deleted
  ORDER BY m.chat_id, m.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_counts_for_chats(
  p_me_id uuid,
  p_chat_ids uuid[],
  p_last_read jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (chat_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.chat_id,
    COUNT(*)::bigint AS unread_count
  FROM public.messages m
  WHERE m.chat_id = ANY(p_chat_ids)
    AND NOT m.is_deleted
    AND m.sender_id <> p_me_id
    AND (
      p_last_read ->> m.chat_id::text IS NULL
      OR m.created_at > (p_last_read ->> m.chat_id::text)::timestamptz
    )
  GROUP BY m.chat_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_messages_for_chats(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_counts_for_chats(uuid, uuid[], jsonb) TO anon, authenticated;

-- Group active calls + settings (see 20260521120000_group_active_calls.sql)
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS group_members_can_start_calls boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.group_active_calls (
  chat_id uuid PRIMARY KEY REFERENCES public.chats(id) ON DELETE CASCADE,
  call_id uuid NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  group_title text,
  joined_user_ids uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_active_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_active_calls_select_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_select_member" ON public.group_active_calls
  FOR SELECT TO authenticated USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "group_active_calls_insert_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_insert_member" ON public.group_active_calls
  FOR INSERT TO authenticated
  WITH CHECK (host_id = public.my_profile_id() AND public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "group_active_calls_update_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_update_member" ON public.group_active_calls
  FOR UPDATE TO authenticated USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "group_active_calls_delete_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_delete_member" ON public.group_active_calls
  FOR DELETE TO authenticated USING (public.is_chat_member(chat_id));

CREATE OR REPLACE FUNCTION public.update_group_call_log_message(
  p_message_id uuid, p_chat_id uuid, p_attachment_name text, p_content text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_chat_member(p_chat_id) THEN RAISE EXCEPTION 'not a member'; END IF;
  UPDATE public.messages SET attachment_name = p_attachment_name, content = p_content
  WHERE id = p_message_id AND chat_id = p_chat_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_group_call_log_message(uuid, uuid, text, text) TO authenticated;
