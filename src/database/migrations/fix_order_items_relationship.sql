-- Migration: Fix order_items relationship
-- Description: Ensures order_items has a valid foreign key to orders and products, and refreshes PostgREST schema cache.

-- 1. Fix relationship to orders
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 2. Fix relationship to products
ALTER TABLE public.order_items
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE CASCADE;

-- 3. Refresh PostgREST schema cache
-- This is crucial for Supabase to pick up relationship changes immediately
NOTIFY pgrst, 'reload schema';
