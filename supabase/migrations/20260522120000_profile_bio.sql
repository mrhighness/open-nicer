-- Optional short bio on profiles (shown on invite / profile pages)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 280);

COMMENT ON COLUMN public.profiles.bio IS 'User-written bio; shown on public profile link';

-- Return type (OUT columns) changed; CREATE OR REPLACE cannot alter it — drop first.
DROP FUNCTION IF EXISTS public.get_profile_for_invite(uuid);

CREATE FUNCTION public.get_profile_for_invite(target_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  status TEXT,
  bio TEXT,
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
    p.bio,
    COALESCE(p.allow_incoming_messages, true)
  FROM public.profiles p
  WHERE p.id = target_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_for_invite(UUID) TO anon, authenticated;
