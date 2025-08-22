-- Create storage buckets for personalization data
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'models',
  'models',
  false,
  104857600, -- 100MB in bytes
  ARRAY['application/zip', 'application/json']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for models bucket
CREATE POLICY "Users can upload their own personalization data" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own personalization data" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own personalization data" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own personalization data" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'models' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
