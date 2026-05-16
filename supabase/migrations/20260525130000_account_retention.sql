-- Account retention: unique 5-digit public ID + optional 4-digit Nicer PIN (bcrypt via pgcrypto)
-- for cross-browser / lost-device recovery.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS retention_public_id integer,
  ADD COLUMN IF NOT EXISTS retention_pin_hash text,
  ADD COLUMN IF NOT EXISTS retention_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_failed_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_lockout_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_retention_public_id_key
  ON public.profiles (retention_public_id)
  WHERE retention_public_id IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_retention_public_id_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_retention_public_id_range
  CHECK (retention_public_id IS NULL OR (retention_public_id >= 10000 AND retention_public_id <= 99999));

-- Assign a unique 5-digit ID on every new profile row.
CREATE OR REPLACE FUNCTION public.profiles_assign_retention_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v int;
  safety int := 0;
BEGIN
  IF NEW.retention_public_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    v := (floor(random() * 90000) + 10000)::int;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.retention_public_id = v);
    safety := safety + 1;
    IF safety > 600 THEN
      RAISE EXCEPTION 'could not assign retention_public_id';
    END IF;
  END LOOP;
  NEW.retention_public_id := v;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_retention_public_id ON public.profiles;
CREATE TRIGGER trg_profiles_retention_public_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_assign_retention_public_id();

-- Backfill existing rows (trigger does not run on UPDATE-only history).
DO $$
DECLARE
  r record;
  v int;
  safety int;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE retention_public_id IS NULL
  LOOP
    safety := 0;
    LOOP
      v := (floor(random() * 90000) + 10000)::int;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.retention_public_id = v);
      safety := safety + 1;
      IF safety > 600 THEN
        RAISE EXCEPTION 'retention backfill failed for %', r.id;
      END IF;
    END LOOP;
    UPDATE public.profiles SET retention_public_id = v WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.retention_pin_valid(p_pin text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_pin IS NOT NULL AND char_length(p_pin) = 4 AND p_pin ~ '^[0-9]{4}$';
$$;

-- Authenticated: show current retention id + whether PIN is set.
CREATE OR REPLACE FUNCTION public.retention_bootstrap_my_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_public int;
  v_has_pin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT p.id, p.retention_public_id, (p.retention_pin_hash IS NOT NULL)
  INTO v_id, v_public, v_has_pin
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  RETURN jsonb_build_object('retention_public_id', v_public, 'pin_set', v_has_pin);
END;
$$;

-- Legacy / claim path: same payload for onboarding before auth is wired.
CREATE OR REPLACE FUNCTION public.retention_bootstrap_code_claim(p_profile_id uuid, p_claim_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public int;
  v_has_pin boolean;
BEGIN
  SELECT p.retention_public_id, (p.retention_pin_hash IS NOT NULL)
  INTO v_public, v_has_pin
  FROM public.profiles p
  WHERE p.id = p_profile_id AND p.claim_token = p_claim_token
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_claim';
  END IF;
  RETURN jsonb_build_object('retention_public_id', v_public, 'pin_set', v_has_pin);
END;
$$;

-- Set or change PIN (authenticated profile).
CREATE OR REPLACE FUNCTION public.retention_activate_pin(p_pin text, p_old_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.retention_pin_valid(p_pin) THEN
    RAISE EXCEPTION 'invalid_pin_format';
  END IF;
  SELECT * INTO row FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  IF row.retention_pin_hash IS NOT NULL THEN
    IF p_old_pin IS NULL OR NOT (crypt(p_old_pin, row.retention_pin_hash) = row.retention_pin_hash) THEN
      RAISE EXCEPTION 'wrong_old_pin';
    END IF;
  END IF;
  UPDATE public.profiles
  SET
    retention_pin_hash = crypt(p_pin, gen_salt('bf', 8)),
    retention_enabled_at = COALESCE(retention_enabled_at, now()),
    retention_failed_attempts = 0,
    retention_lockout_until = NULL
  WHERE id = row.id;
  RETURN jsonb_build_object('ok', true, 'retention_public_id', row.retention_public_id);
END;
$$;

-- Set or change PIN when the client holds profile id + claim_token (legacy anon).
CREATE OR REPLACE FUNCTION public.retention_activate_pin_claim(
  p_profile_id uuid,
  p_claim_token uuid,
  p_pin text,
  p_old_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.profiles%ROWTYPE;
BEGIN
  IF NOT public.retention_pin_valid(p_pin) THEN
    RAISE EXCEPTION 'invalid_pin_format';
  END IF;
  SELECT * INTO row FROM public.profiles WHERE id = p_profile_id AND claim_token = p_claim_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_claim';
  END IF;
  IF row.retention_pin_hash IS NOT NULL THEN
    IF p_old_pin IS NULL OR NOT (crypt(p_old_pin, row.retention_pin_hash) = row.retention_pin_hash) THEN
      RAISE EXCEPTION 'wrong_old_pin';
    END IF;
  END IF;
  UPDATE public.profiles
  SET
    retention_pin_hash = crypt(p_pin, gen_salt('bf', 8)),
    retention_enabled_at = COALESCE(retention_enabled_at, now()),
    retention_failed_attempts = 0,
    retention_lockout_until = NULL
  WHERE id = row.id;
  RETURN jsonb_build_object('ok', true, 'retention_public_id', row.retention_public_id);
END;
$$;

-- Swap Supabase auth from current profile row to the retained profile (same auth session).
CREATE OR REPLACE FUNCTION public.retention_recover_swap(p_public_id integer, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_old public.profiles%ROWTYPE;
  p_new public.profiles%ROWTYPE;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.retention_pin_valid(p_pin) THEN
    RAISE EXCEPTION 'invalid_pin_format';
  END IF;

  SELECT * INTO p_old
  FROM public.profiles
  WHERE retention_public_id = p_public_id AND retention_pin_hash IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.12);
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF p_old.retention_lockout_until IS NOT NULL AND p_old.retention_lockout_until > now() THEN
    RAISE EXCEPTION 'locked';
  END IF;

  IF NOT (crypt(p_pin, p_old.retention_pin_hash) = p_old.retention_pin_hash) THEN
    UPDATE public.profiles
    SET
      retention_failed_attempts = retention_failed_attempts + 1,
      retention_lockout_until = CASE
        WHEN retention_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE retention_lockout_until
      END
    WHERE id = p_old.id;
    PERFORM pg_sleep(0.18);
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  SELECT * INTO p_new FROM public.profiles WHERE auth_user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_current_profile';
  END IF;

  IF p_new.id = p_old.id THEN
    UPDATE public.profiles
    SET retention_failed_attempts = 0, retention_lockout_until = NULL
    WHERE id = p_old.id;
    RETURN jsonb_build_object('profile_id', p_old.id, 'claim_token', p_old.claim_token);
  END IF;

  UPDATE public.profiles SET auth_user_id = NULL WHERE id = p_new.id;
  UPDATE public.profiles SET auth_user_id = NULL WHERE id = p_old.id;
  UPDATE public.profiles
  SET
    auth_user_id = uid,
    retention_failed_attempts = 0,
    retention_lockout_until = NULL
  WHERE id = p_old.id;

  RETURN jsonb_build_object('profile_id', p_old.id, 'claim_token', p_old.claim_token);
END;
$$;

-- Recovery without Supabase auth (legacy localStorage + claim_token only).
CREATE OR REPLACE FUNCTION public.retention_recover_claim(p_public_id integer, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_old public.profiles%ROWTYPE;
BEGIN
  IF NOT public.retention_pin_valid(p_pin) THEN
    RAISE EXCEPTION 'invalid_pin_format';
  END IF;

  SELECT * INTO p_old
  FROM public.profiles
  WHERE retention_public_id = p_public_id AND retention_pin_hash IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM pg_sleep(0.12);
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF p_old.retention_lockout_until IS NOT NULL AND p_old.retention_lockout_until > now() THEN
    RAISE EXCEPTION 'locked';
  END IF;

  IF NOT (crypt(p_pin, p_old.retention_pin_hash) = p_old.retention_pin_hash) THEN
    UPDATE public.profiles
    SET
      retention_failed_attempts = retention_failed_attempts + 1,
      retention_lockout_until = CASE
        WHEN retention_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE retention_lockout_until
      END
    WHERE id = p_old.id;
    PERFORM pg_sleep(0.18);
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  UPDATE public.profiles
  SET retention_failed_attempts = 0, retention_lockout_until = NULL
  WHERE id = p_old.id;

  RETURN jsonb_build_object('profile_id', p_old.id, 'claim_token', p_old.claim_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.retention_bootstrap_my_code() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_bootstrap_code_claim(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_activate_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_activate_pin_claim(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_recover_swap(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_recover_claim(integer, text) TO anon, authenticated;

-- Do not expose bcrypt hash to the browser (profiles are often selected with *).
REVOKE SELECT (retention_pin_hash) ON public.profiles FROM anon;
REVOKE SELECT (retention_pin_hash) ON public.profiles FROM authenticated;
