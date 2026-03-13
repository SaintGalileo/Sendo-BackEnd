-- Migration: Setup Orders and Order Items (Fixed for public.users and non-auth)
-- Description: Creates orders and order_items tables with necessary columns and RLS.

-- 1. Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure all required columns exist in orders
DO $$ 
BEGIN 
    -- user_id (if not added during creation)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='user_id') THEN
        ALTER TABLE public.orders ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;

    -- merchant_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='merchant_id') THEN
        ALTER TABLE public.orders ADD COLUMN merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE;
    END IF;

    -- address_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='address_id') THEN
        ALTER TABLE public.orders ADD COLUMN address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL;
    END IF;

    -- Financials
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='subtotal') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_fee') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_fee DECIMAL(12, 2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0;
    END IF;

    -- Status and Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='status') THEN
        ALTER TABLE public.orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='notes') THEN
        ALTER TABLE public.orders ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method TEXT DEFAULT 'wallet';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_status') THEN
        ALTER TABLE public.orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;

    -- Delivery
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='courier_id') THEN
        ALTER TABLE public.orders ADD COLUMN courier_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='estimated_delivery_time') THEN
        ALTER TABLE public.orders ADD COLUMN estimated_delivery_time TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Create order_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    extras JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE SECURITY
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES: Orders
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
    CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Merchants can view their store orders" ON public.orders;
    CREATE POLICY "Merchants can view their store orders" ON public.orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid()));
END $$;

-- 6. POLICIES: Order Items
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
    CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

    DROP POLICY IF EXISTS "Merchants can view their order items" ON public.order_items;
    CREATE POLICY "Merchants can view their order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders JOIN merchants ON orders.merchant_id = merchants.id WHERE orders.id = order_items.order_id AND merchants.user_id = auth.uid()));
END $$;

-- 7. TRIGGER for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
