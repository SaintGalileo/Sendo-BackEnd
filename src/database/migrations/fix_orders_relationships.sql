-- Migration: Fix Orders Table Relationships
-- Description: Unifies column names (consumer_id) and ensures correct foreign keys to users, merchants, and couriers.
-- Also refreshes PostgREST schema cache.

DO $$ 
BEGIN 
    -- 1. Ensure columns exist
    
    -- Rename user_id to consumer_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='user_id') THEN
        ALTER TABLE public.orders RENAME COLUMN user_id TO consumer_id;
    END IF;

    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='consumer_id') THEN
        ALTER TABLE public.orders ADD COLUMN consumer_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='merchant_id') THEN
        ALTER TABLE public.orders ADD COLUMN merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='courier_id') THEN
        ALTER TABLE public.orders ADD COLUMN courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL;
    END IF;

    -- 2. Fix/Ensure Foreign Keys
    
    -- Drop existing potentially incorrect constraints
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_consumer_id_fkey;
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_merchant_id_fkey;
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_courier_id_fkey;

    -- Add correct constraints
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;

    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.couriers(id) ON DELETE SET NULL;

END $$;

-- 3. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
