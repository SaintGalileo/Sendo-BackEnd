-- Flash sales + product join table for admin flash-sale CRUD.
-- Safe to run multiple times. Backend uses SUPABASE_ANON_KEY — anon needs CRUD.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  store_name TEXT,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  admin_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  owner_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flash_sale_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id UUID NOT NULL REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flash_sale_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_merchant_id ON public.flash_sales (merchant_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON public.flash_sales (status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_starts_at ON public.flash_sales (starts_at);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale ON public.flash_sale_products (flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_product ON public.flash_sale_products (product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_sales TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_sale_products TO anon, authenticated, service_role;

ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sale_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to flash_sales" ON public.flash_sales;
CREATE POLICY "Allow all access to flash_sales"
  ON public.flash_sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to flash_sale_products" ON public.flash_sale_products;
CREATE POLICY "Allow all access to flash_sale_products"
  ON public.flash_sale_products FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
