-- Migration: Add Missing Order Statuses
-- Description: Adds 'preparing', 'ready_for_pickup', 'picked_up', and 'on_the_way' to the order_status enum.

DO $$ 
BEGIN
    -- Add 'preparing'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'preparing' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'preparing' AFTER 'accepted';
    END IF;

    -- Add 'ready_for_pickup'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ready_for_pickup' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'ready_for_pickup' AFTER 'preparing';
    END IF;

    -- Add 'picked_up'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'picked_up' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'picked_up' AFTER 'ready_for_pickup';
    END IF;

    -- Add 'on_the_way'
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_the_way' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')) THEN
        ALTER TYPE public.order_status ADD VALUE 'on_the_way' AFTER 'picked_up';
    END IF;
END $$;
