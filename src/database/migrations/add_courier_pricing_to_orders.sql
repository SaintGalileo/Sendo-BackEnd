-- Store two-leg delivery distances (courier -> merchant + merchant -> customer)
-- and the locked-in courier payout on each order.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_earning DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS pickup_distance_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dropoff_distance_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS total_distance_km DOUBLE PRECISION;

COMMENT ON COLUMN public.orders.courier_earning IS 'Locked-in courier payout (80% of two-leg delivery fee) computed when courier accepts or is assigned';
COMMENT ON COLUMN public.orders.pickup_distance_km IS 'Distance in km from courier location to merchant at quote/acceptance time';
COMMENT ON COLUMN public.orders.dropoff_distance_km IS 'Distance in km from merchant to customer delivery address';
COMMENT ON COLUMN public.orders.total_distance_km IS 'Total trip distance in km (pickup_distance_km + dropoff_distance_km)';

NOTIFY pgrst, 'reload schema';
