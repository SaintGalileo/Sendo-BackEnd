-- Vendor base price stays in products.price; customer-facing amount is products.surge_price
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS surge_price DECIMAL(10, 2);

-- Backfill: until next vendor save, customers see the same amount as base price
UPDATE public.products
SET surge_price = price
WHERE surge_price IS NULL AND price IS NOT NULL;

NOTIFY pgrst, 'reload schema';
