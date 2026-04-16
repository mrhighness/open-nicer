-- Profiles (anonymous users, no auth)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'Hey there! I am using Nicer.',
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chats (one-to-one for now)
CREATE TABLE public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chats_users_ordered CHECK (user_a < user_b),
  CONSTRAINT chats_unique_pair UNIQUE (user_a, user_b)
);

CREATE INDEX idx_chats_user_a ON public.chats(user_a);
CREATE INDEX idx_chats_user_b ON public.chats(user_b);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_chat_id_created ON public.messages(chat_id, created_at);

-- Reactions
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON public.reactions(message_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no-auth demo app)
CREATE POLICY "anyone read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "anyone insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone update profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "anyone read chats" ON public.chats FOR SELECT USING (true);
CREATE POLICY "anyone insert chats" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone delete chats" ON public.chats FOR DELETE USING (true);

CREATE POLICY "anyone read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "anyone insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone update messages" ON public.messages FOR UPDATE USING (true);
CREATE POLICY "anyone delete messages" ON public.messages FOR DELETE USING (true);

CREATE POLICY "anyone read reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "anyone insert reactions" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone delete reactions" ON public.reactions FOR DELETE USING (true);

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;