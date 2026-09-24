-- Fulfillment modes (merchant) + order fulfillment type
-- User said they already ran this; kept for repo/docs.

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS fulfillment_modes TEXT NOT NULL DEFAULT 'delivery';

-- Optional: enforce allowed values (skip if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_fulfillment_modes_check'
  ) THEN
    ALTER TABLE public.merchants
      ADD CONSTRAINT merchants_fulfillment_modes_check
      CHECK (fulfillment_modes IN ('pickup', 'delivery', 'both'));
  END IF;
END $$;

UPDATE public.merchants
SET fulfillment_modes = 'pickup'
WHERE COALESCE(is_pickup_only, false) = true
  AND fulfillment_modes = 'delivery';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'delivery';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_type_check
      CHECK (fulfillment_type IN ('pickup', 'delivery'));
  END IF;
END $$;

-- Allow pickup orders without a customer delivery address
-- (app still snapshots store address into delivery_address for display)
ALTER TABLE public.orders
ALTER COLUMN delivery_address DROP NOT NULL;
