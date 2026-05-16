-- Fallback RLS for anon key when Supabase Auth providers are disabled (demo / local dev).
-- Authenticated users still use the stricter policies from security_hardening.

CREATE POLICY "profiles_legacy_anon" ON public.profiles
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "chats_legacy_anon" ON public.chats
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "messages_legacy_anon" ON public.messages
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reactions_legacy_anon" ON public.reactions
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "storage_legacy_anon" ON storage.objects
  FOR ALL TO anon
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');
