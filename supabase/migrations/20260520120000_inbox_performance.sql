-- Fast inbox previews and unread counts (avoids loading entire messages table client-side)

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
