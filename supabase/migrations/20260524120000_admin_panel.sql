-- =============================================================================
-- Admin panel: whitelist, suspension, signup telemetry, admin RPCs
-- =============================================================================
-- BEFORE RUNNING:
-- 1) In Supabase Dashboard → Authentication → Users: create user hcfacy@gmail.com
--    with your chosen password (confirm email if required).
-- 2) Link that auth user to a profile row (auth_user_id) OR use "Sign in" on the
--    app once so a profile exists with auth_user_id set.
-- Passwords CANNOT be set safely in raw SQL here; use the Dashboard.
-- =============================================================================

-- Whitelist: JWT email must match (after signInWithPassword on the client).
CREATE TABLE IF NOT EXISTS public.app_admins (
  email text PRIMARY KEY
);

INSERT INTO public.app_admins (email)
VALUES (lower(trim('hcfacy@gmail.com')))
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_admins_deny_all" ON public.app_admins;
CREATE POLICY "app_admins_deny_all" ON public.app_admins FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins a
    WHERE lower(a.email) = lower(coalesce(nullif(trim(auth.jwt() ->> 'email'), ''), ''))
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON public.profiles(invited_by);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_at ON public.profiles(suspended_at) WHERE suspended_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.suspended_at IS 'When set, user sees suspended screen in the app.';
COMMENT ON COLUMN public.profiles.invited_by IS 'Profile id of the user whose invite link was open when this profile was created.';

-- Private signup analytics (not exposed on public profile reads).
CREATE TABLE IF NOT EXISTS public.profile_signup_meta (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_agent text,
  ip text,
  country text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_signup_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signup_meta_deny" ON public.profile_signup_meta;
CREATE POLICY "signup_meta_deny" ON public.profile_signup_meta FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.record_signup_client_info(
  p_user_agent text,
  p_ip text DEFAULT NULL,
  p_country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := public.my_profile_id();
  IF pid IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.profile_signup_meta (profile_id, user_agent, ip, country)
  VALUES (
    pid,
    left(coalesce(p_user_agent, ''), 4000),
    nullif(left(trim(coalesce(p_ip, '')), 128), ''),
    nullif(left(trim(coalesce(p_country, '')), 128), '')
  )
  ON CONFLICT (profile_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_signup_client_info(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_signup_client_info(text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN jsonb_build_object(
    'user_count', (SELECT count(*)::int FROM public.profiles),
    'group_count', (SELECT count(*)::int FROM public.chats WHERE coalesce(chat_type, 'direct') = 'group'),
    'suspended_count', (SELECT count(*)::int FROM public.profiles WHERE suspended_at IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  status text,
  bio text,
  created_at timestamptz,
  suspended_at timestamptz,
  invited_by uuid,
  auth_user_id uuid,
  email text,
  user_agent text,
  ip text,
  country text,
  invite_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.status,
    p.bio,
    p.created_at,
    p.suspended_at,
    p.invited_by,
    p.auth_user_id,
    u.email::text AS email,
    m.user_agent,
    m.ip,
    m.country,
    (SELECT count(*)::bigint FROM public.profiles c WHERE c.invited_by = p.id) AS invite_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.auth_user_id
  LEFT JOIN public.profile_signup_meta m ON m.profile_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_groups()
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.created_at,
    (SELECT count(*)::bigint FROM public.chat_members m WHERE m.chat_id = c.id) AS member_count
  FROM public.chats c
  WHERE coalesce(c.chat_type, 'direct') = 'group'
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_groups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_groups() TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_id uuid,
  p_username text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_bio text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.profiles
  SET
    username = coalesce(nullif(trim(p_username), ''), username),
    avatar_url = CASE
      WHEN p_avatar_url IS NULL THEN avatar_url
      WHEN trim(p_avatar_url) = '' THEN NULL
      ELSE trim(p_avatar_url)
    END,
    bio = CASE
      WHEN p_bio IS NULL THEN bio
      WHEN trim(p_bio) = '' THEN NULL
      ELSE left(trim(p_bio), 280)
    END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_suspended(p_id uuid, p_suspend boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.profiles
  SET suspended_at = CASE WHEN p_suspend THEN coalesce(suspended_at, now()) ELSE NULL END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_suspended(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_suspended(uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_profiles(p_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  DELETE FROM public.profiles WHERE id = ANY (p_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_profiles(uuid[]) TO authenticated;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_groups(p_ids uuid[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  DELETE FROM public.chats
  WHERE id = ANY (p_ids) AND coalesce(chat_type, 'direct') = 'group';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_groups(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_groups(uuid[]) TO authenticated;
