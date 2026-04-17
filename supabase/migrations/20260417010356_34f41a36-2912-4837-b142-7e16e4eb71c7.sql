
-- Add attachment fields to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint,
  ADD COLUMN IF NOT EXISTS attachment_duration numeric;

-- Allow empty content when attachment is present
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- Create public attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (open like the rest of the app's RLS)
DROP POLICY IF EXISTS "anyone read attachments" ON storage.objects;
CREATE POLICY "anyone read attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "anyone upload attachments" ON storage.objects;
CREATE POLICY "anyone upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "anyone update attachments" ON storage.objects;
CREATE POLICY "anyone update attachments" ON storage.objects
  FOR UPDATE USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "anyone delete attachments" ON storage.objects;
CREATE POLICY "anyone delete attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'attachments');
