-- Security hardening: bind profiles to Supabase Auth, enforce RLS, constrain storage & content.
-- Requires Anonymous sign-ins enabled in Supabase Dashboard → Authentication → Providers.

-- Link profiles to authenticated users (anonymous auth keeps no-sign-up UX)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS claim_token UUID DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);

-- Helpers (SECURITY DEFINER — used by RLS policies)
CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

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
      AND (c.user_a = public.my_profile_id() OR c.user_b = public.my_profile_id())
  );
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
    );
$$;

-- Message / profile size limits
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_max_len;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_max_len CHECK (char_length(content) <= 10000);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_len CHECK (char_length(username) BETWEEN 2 AND 32);

ALTER TABLE public.reactions
  DROP CONSTRAINT IF EXISTS reactions_emoji_len;
ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 8);

-- Drop permissive demo policies
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

-- Profiles
CREATE POLICY "profiles_select_visible" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.profile_is_visible(id));

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "profiles_claim_once" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id IS NULL)
  WITH CHECK (auth_user_id = auth.uid());

-- Chats
CREATE POLICY "chats_select_member" ON public.chats
  FOR SELECT TO authenticated
  USING (user_a = public.my_profile_id() OR user_b = public.my_profile_id());

CREATE POLICY "chats_insert_participant" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_a = public.my_profile_id() OR user_b = public.my_profile_id())
    AND user_a < user_b
  );

-- Messages
CREATE POLICY "messages_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id));

CREATE POLICY "messages_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.my_profile_id()
    AND public.is_chat_member(chat_id)
  );

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = public.my_profile_id())
  WITH CHECK (sender_id = public.my_profile_id());

-- Reactions
CREATE POLICY "reactions_select_member" ON public.reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_chat_member(m.chat_id)
    )
  );

CREATE POLICY "reactions_insert_own" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.my_profile_id());

CREATE POLICY "reactions_delete_own" ON public.reactions
  FOR DELETE TO authenticated
  USING (user_id = public.my_profile_id());

-- Storage: replace open policies
DROP POLICY IF EXISTS "anyone read attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone update attachments" ON storage.objects;
DROP POLICY IF EXISTS "anyone delete attachments" ON storage.objects;

CREATE POLICY "storage_read_attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      name LIKE 'avatars/%'
      OR public.is_chat_member(((storage.foldername(name))[1])::uuid)
    )
  );

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

CREATE POLICY "storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[2] = public.my_profile_id()::text
      OR name LIKE ('avatars/' || public.my_profile_id()::text || '/%')
    )
  );

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[2] = public.my_profile_id()::text
      OR name LIKE ('avatars/' || public.my_profile_id()::text || '/%')
    )
  );
