-- Public profile lookup by invite link (UUID is the capability token)

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
