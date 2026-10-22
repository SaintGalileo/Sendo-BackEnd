-- Migration: Add cancellation_reason to the orders table
-- Run this query in your Supabase SQL Editor.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Comments explaining column purposes
COMMENT ON COLUMN public.orders.cancellation_reason IS 'Reason provided when an order is cancelled or declined by vendor, user, or admin';
