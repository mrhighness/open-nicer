-- Profile privacy & presence settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_incoming_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.discoverable IS 'When false, hidden from search and new-chat discovery';
COMMENT ON COLUMN public.profiles.allow_incoming_messages IS 'When false, others cannot start new chats; hidden user can still message others';
COMMENT ON COLUMN public.profiles.show_online_status IS 'When false, others do not see online indicator';
