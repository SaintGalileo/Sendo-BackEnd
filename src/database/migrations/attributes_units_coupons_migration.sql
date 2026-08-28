-- SQL Migration: Catalog attributes, units, and coupons
-- Creates tables expected by admin.attributes / admin.units / admin.coupons
-- and the consumer coupons service. Backend uses the anon key, so grants + RLS
-- must allow anon CRUD. Refresh PostgREST after apply.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Attributes (name, type, Active/Inactive)
CREATE TABLE IF NOT EXISTS public.attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'dropdown',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Units
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Coupons (admin uses expires_at; consumer uses valid_until)
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    title TEXT,
    discount_type TEXT,
    discount_value NUMERIC,
    min_order_amount NUMERIC,
    max_uses INT,
    used_count INT NOT NULL DEFAULT 0,
    usage_limit_per_user INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep expires_at and valid_until in sync on write
CREATE OR REPLACE FUNCTION public.sync_coupon_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL AND NEW.valid_until IS NULL THEN
        NEW.valid_until := NEW.expires_at;
    ELSIF NEW.valid_until IS NOT NULL AND NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.valid_until;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_coupon_expiry ON public.coupons;
CREATE TRIGGER trg_sync_coupon_expiry
    BEFORE INSERT OR UPDATE ON public.coupons
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_coupon_expiry();

-- 4. Grants (admin backend uses SUPABASE_ANON_KEY)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_usages TO anon, authenticated, service_role;

-- 5. RLS — permissive so anon-key admin CRUD works
ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to attributes" ON public.attributes;
CREATE POLICY "Allow all access to attributes" ON public.attributes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to units" ON public.units;
CREATE POLICY "Allow all access to units" ON public.units FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to coupons" ON public.coupons;
CREATE POLICY "Allow all access to coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to coupon_usages" ON public.coupon_usages;
CREATE POLICY "Allow all access to coupon_usages" ON public.coupon_usages FOR ALL USING (true) WITH CHECK (true);

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
