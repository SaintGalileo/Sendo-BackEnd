-- Migration: Add separate merchant_notes and rider_notes to the orders table
-- Run this query in your Supabase SQL Editor.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS merchant_notes TEXT,
ADD COLUMN IF NOT EXISTS rider_notes TEXT;

-- Comments explaining column purposes
COMMENT ON COLUMN public.orders.merchant_notes IS 'Customer preparation notes and instructions specifically for the store or merchant (e.g. food prep, cutlery, packaging)';
COMMENT ON COLUMN public.orders.rider_notes IS 'Customer delivery instructions specifically for the delivery rider (e.g. gate code, landmark, call on arrival)';
