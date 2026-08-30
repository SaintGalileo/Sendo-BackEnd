-- Mirror of 202608300003_product_stock_images_uploads.sql

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-uploads', 'admin-uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read admin-uploads" ON storage.objects;
CREATE POLICY "Public read admin-uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'admin-uploads');

DROP POLICY IF EXISTS "Anon upload admin-uploads" ON storage.objects;
CREATE POLICY "Anon upload admin-uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'admin-uploads');

DROP POLICY IF EXISTS "Anon update admin-uploads" ON storage.objects;
CREATE POLICY "Anon update admin-uploads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'admin-uploads');

DROP POLICY IF EXISTS "Anon delete admin-uploads" ON storage.objects;
CREATE POLICY "Anon delete admin-uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'admin-uploads');

NOTIFY pgrst, 'reload schema';
