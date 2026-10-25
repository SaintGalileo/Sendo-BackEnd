-- ========================================================
-- Migration: Add 4-Digit Order Verification Codes
-- ========================================================
-- This migration adds 4-digit verification code columns to the orders table:
-- 1. pickup_code: 4-digit code shown to customer for pickup orders,
--    verified by vendor upon collection to complete the order.
-- 2. delivery_code: 4-digit code shown to customer for delivery orders,
--    verified by rider upon dropoff to complete the delivery.
-- 3. driver_pickup_code: 4-digit claim code shown to rider for delivery orders,
--    given to the vendor to claim/release the product.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS driver_pickup_code VARCHAR(10);

-- Indexes for fast lookup if needed
CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON public.orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_code ON public.orders(delivery_code);
CREATE INDEX IF NOT EXISTS idx_orders_driver_pickup_code ON public.orders(driver_pickup_code);

-- Explanatory column comments
COMMENT ON COLUMN public.orders.pickup_code IS '4-digit verification code shown to user for pickup orders. Entered by vendor to complete the order.';
COMMENT ON COLUMN public.orders.delivery_code IS '4-digit verification code shown to user for delivery orders. Entered by rider to complete delivery.';
COMMENT ON COLUMN public.orders.driver_pickup_code IS '4-digit claim code shown to rider for delivery orders. Given to vendor to claim the package.';

-- Reload PostgREST schema cache so columns are immediately visible to Supabase client
NOTIFY pgrst, 'reload schema';
