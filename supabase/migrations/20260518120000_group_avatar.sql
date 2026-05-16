-- Group profile photo + member-visible chat reads + admin updates

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.chats.avatar_url IS 'Group profile image URL (visible to all members)';

DROP POLICY IF EXISTS "chats_select_member" ON public.chats;
CREATE POLICY "chats_select_member" ON public.chats
  FOR SELECT TO authenticated
  USING (
    user_a = public.my_profile_id()
    OR user_b = public.my_profile_id()
    OR public.is_chat_member(id)
  );

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
