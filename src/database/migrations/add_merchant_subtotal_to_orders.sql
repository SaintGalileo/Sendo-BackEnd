-- Migration: Add merchant_subtotal to orders table
-- This stores the base product amount owed to the merchant with 0% commission deducted.
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS merchant_subtotal DECIMAL(12, 2);

COMMENT ON COLUMN public.orders.merchant_subtotal IS 'Total amount owed to the merchant for base product prices plus extras (with 0% commission deducted)';
