-- ========================================================
-- REFINED ORDERS TABLE (Sendo Premium)
-- ========================================================
-- This script creates ONLY the 'orders' table, designed to
-- fit perfectly with your existing users, merchants, and couriers.

-- NOTE: If you are deleting your old table first, run:
-- DROP TABLE IF EXISTS public.orders CASCADE;

CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE, -- Professional reference (e.g., ORD-20240319-X72A)
    
    -- Relationships
    consumer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL, -- References your couriers table
    address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL, -- Optional link to address book
    
    -- Financials 
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Total amount paid
    
    -- Status & Payment 
    status public.order_status NOT NULL DEFAULT 'pending', -- Uses your existing enum
    payment_method TEXT NOT NULL DEFAULT 'wallet', -- 'wallet', 'card', 'cash'
    payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
    
    -- Delivery Details (Snapshot of location at time of order)
    delivery_address TEXT NOT NULL, 
    delivery_lat DOUBLE PRECISION,
    delivery_lng DOUBLE PRECISION,
    estimated_delivery_time TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_orders_consumer_id ON public.orders(consumer_id);
CREATE INDEX idx_orders_merchant_id ON public.orders(merchant_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Auto-generate professional order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 4));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION generate_order_number();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at 
BEFORE UPDATE ON public.orders 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();
