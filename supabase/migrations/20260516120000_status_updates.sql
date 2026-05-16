-- Image status updates (24h expiry, WhatsApp-style)

CREATE TABLE public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_status_updates_user_created ON public.status_updates(user_id, created_at DESC);
CREATE INDEX idx_status_updates_expires ON public.status_updates(expires_at);

CREATE TABLE public.status_views (
  status_id UUID NOT NULL REFERENCES public.status_updates(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

CREATE INDEX idx_status_views_viewer ON public.status_views(viewer_id);

ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

-- status_updates policies
CREATE POLICY "status_updates_select_visible" ON public.status_updates
  FOR SELECT TO authenticated
  USING (expires_at > now() AND public.profile_is_visible(user_id));

CREATE POLICY "status_updates_insert_own" ON public.status_updates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.my_profile_id());

CREATE POLICY "status_updates_delete_own" ON public.status_updates
  FOR DELETE TO authenticated
  USING (user_id = public.my_profile_id());

-- Legacy / demo fallback when auth helpers unavailable
CREATE POLICY "status_updates_select_legacy" ON public.status_updates
  FOR SELECT TO anon, authenticated
  USING (expires_at > now());

CREATE POLICY "status_updates_insert_legacy" ON public.status_updates
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "status_updates_delete_legacy" ON public.status_updates
  FOR DELETE TO anon, authenticated
  USING (true);

CREATE POLICY "status_views_select" ON public.status_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = public.my_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.status_updates s
      WHERE s.id = status_id AND s.user_id = public.my_profile_id()
    )
  );

CREATE POLICY "status_views_insert" ON public.status_views
  FOR INSERT TO authenticated
  WITH CHECK (viewer_id = public.my_profile_id());

CREATE POLICY "status_views_all_legacy" ON public.status_views
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Storage: status/{userId}/*
DROP POLICY IF EXISTS "storage_insert_status" ON storage.objects;
CREATE POLICY "storage_insert_status" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'status'
    AND (storage.foldername(name))[2] = public.my_profile_id()::text
  );

DROP POLICY IF EXISTS "storage_read_status" ON storage.objects;
CREATE POLICY "storage_read_status" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'status'
    AND public.profile_is_visible(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "storage_status_legacy" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'status')
  WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'status');

ALTER TABLE public.status_updates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_updates;
