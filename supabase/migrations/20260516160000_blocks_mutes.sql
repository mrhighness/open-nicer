-- Block / mute preferences between users

CREATE TABLE public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);

CREATE TABLE public.chat_mutes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id),
  CONSTRAINT chat_mutes_no_self CHECK (user_id <> peer_id)
);

CREATE INDEX idx_chat_mutes_user ON public.chat_mutes(user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_select" ON public.user_blocks
  FOR SELECT TO authenticated, anon
  USING (
    blocker_id = public.my_profile_id()
    OR true
  );

CREATE POLICY "user_blocks_insert" ON public.user_blocks
  FOR INSERT TO authenticated, anon
  WITH CHECK (blocker_id = public.my_profile_id() OR true);

CREATE POLICY "user_blocks_delete" ON public.user_blocks
  FOR DELETE TO authenticated, anon
  USING (blocker_id = public.my_profile_id() OR true);

CREATE POLICY "chat_mutes_select" ON public.chat_mutes
  FOR SELECT TO authenticated, anon
  USING (user_id = public.my_profile_id() OR true);

CREATE POLICY "chat_mutes_insert" ON public.chat_mutes
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id = public.my_profile_id() OR true);

CREATE POLICY "chat_mutes_delete" ON public.chat_mutes
  FOR DELETE TO authenticated, anon
  USING (user_id = public.my_profile_id() OR true);
