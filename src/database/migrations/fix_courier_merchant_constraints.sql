-- Migration: Fix Unique Constraints for Couriers and Merchants
-- Description: Ensures user_id has a unique constraint for upsert operations.

-- 1. For Couriers table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'couriers_user_id_key' 
        AND conrelid = 'public.couriers'::regclass
    ) THEN
        ALTER TABLE public.couriers ADD CONSTRAINT couriers_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. For Merchants table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'merchants_user_id_key' 
        AND conrelid = 'public.merchants'::regclass
    ) THEN
        ALTER TABLE public.merchants ADD CONSTRAINT merchants_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 3. For courier_locations table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'courier_locations_courier_id_unique' 
        AND conrelid = 'public.courier_locations'::regclass
    ) THEN
        -- If the table exists, add the constraint
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courier_locations') THEN
            ALTER TABLE public.courier_locations ADD CONSTRAINT courier_locations_courier_id_unique UNIQUE (courier_id);
        END IF;
    END IF;
END $$;
