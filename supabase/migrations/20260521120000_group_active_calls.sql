-- Tracks live group calls + group call settings on chats

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS group_members_can_start_calls boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.chats.group_members_can_start_calls IS
  'When false, only group owner/admins can start group calls.';

CREATE TABLE IF NOT EXISTS public.group_active_calls (
  chat_id uuid PRIMARY KEY REFERENCES public.chats(id) ON DELETE CASCADE,
  call_id uuid NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  group_title text,
  joined_user_ids uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_active_calls_call_id_idx ON public.group_active_calls (call_id);

ALTER TABLE public.group_active_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_active_calls_select_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_select_member" ON public.group_active_calls
  FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "group_active_calls_insert_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_insert_member" ON public.group_active_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    host_id = public.my_profile_id()
    AND public.is_chat_member(chat_id)
  );

DROP POLICY IF EXISTS "group_active_calls_update_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_update_member" ON public.group_active_calls
  FOR UPDATE TO authenticated
  USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "group_active_calls_delete_member" ON public.group_active_calls;
CREATE POLICY "group_active_calls_delete_member" ON public.group_active_calls
  FOR DELETE TO authenticated
  USING (public.is_chat_member(chat_id));

CREATE OR REPLACE FUNCTION public.update_group_call_log_message(
  p_message_id uuid,
  p_chat_id uuid,
  p_attachment_name text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_chat_member(p_chat_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;
  UPDATE public.messages
  SET attachment_name = p_attachment_name, content = p_content
  WHERE id = p_message_id AND chat_id = p_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_call_log_message(uuid, uuid, text, text) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_active_calls;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.group_active_calls REPLICA IDENTITY FULL;
