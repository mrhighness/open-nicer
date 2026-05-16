-- Update every call_log row for a 1:1 (or any) call in a chat. Both peers insert their own
-- "ringing" row; SECURITY DEFINER bypasses messages_update_own so either side can finalize all.

CREATE OR REPLACE FUNCTION public.finalize_call_log_for_call(
  p_chat_id uuid,
  p_call_id uuid,
  p_attachment_name text,
  p_content text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.is_chat_member(p_chat_id) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  UPDATE public.messages
  SET attachment_name = p_attachment_name,
      content = p_content
  WHERE chat_id = p_chat_id
    AND attachment_type = 'call_log'
    AND attachment_name IS NOT NULL
    AND length(trim(attachment_name)) > 0
    AND (attachment_name::jsonb ->> 'callId') = p_call_id::text;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_call_log_for_call(uuid, uuid, text, text) TO authenticated;
