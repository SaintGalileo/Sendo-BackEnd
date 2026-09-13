-- Mirror of 202609130001_product_surge_pricing.sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS surge_price DECIMAL(10, 2);

UPDATE public.products
SET surge_price = price
WHERE surge_price IS NULL AND price IS NOT NULL;

NOTIFY pgrst, 'reload schema';
