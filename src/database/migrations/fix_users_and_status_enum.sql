-- SQL Migration: Fix Users Table and Order Status Enum
-- Description: Adds missing columns to 'users' and missing values to 'order_status' enum.

-- 1. Add missing columns to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Add missing order statuses to the enum
DO $$ 
BEGIN
    -- Check and add 'preparing'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'preparing' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'preparing' AFTER 'accepted';
    END IF;

    -- Check and add 'ready_for_pickup'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ready_for_pickup' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'ready_for_pickup' AFTER 'preparing';
    END IF;

    -- Check and add 'picked_up'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'picked_up' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'ready_for_pickup';
    END IF;

    -- Check and add 'on_the_way'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_the_way' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'on_the_way' AFTER 'picked_up';
    END IF;
END $$;
