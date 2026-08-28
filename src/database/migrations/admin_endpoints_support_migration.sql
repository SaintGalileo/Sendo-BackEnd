-- Admin endpoint support: KV store grants, courier earnings, account transactions,
-- and column guards for courier/merchant/admin flows.
-- Mirror of: supabase/migrations/202608280001_admin_endpoints_support.sql
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at
  ON public.admin_settings (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settings TO anon, authenticated, service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to admin_settings" ON public.admin_settings;
CREATE POLICY "Allow all access to admin_settings"
  ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  method TEXT,
  reference TEXT,
  description TEXT,
  order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_earnings_courier_id
  ON public.courier_earnings (courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_earnings_created_at
  ON public.courier_earnings (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_earnings TO anon, authenticated, service_role;

ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to courier_earnings" ON public.courier_earnings;
CREATE POLICY "Allow all access to courier_earnings"
  ON public.courier_earnings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'credit',
  note TEXT,
  description TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  collect_from TEXT,
  source_name TEXT,
  source_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_source_type
  ON public.transactions (source_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated, service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to transactions" ON public.transactions;
CREATE POLICY "Allow all access to transactions"
  ON public.transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON public.users (is_super_admin) WHERE is_super_admin = true;

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);

ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'bike';
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS plate_number TEXT;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS public.attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'dropdown',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO anon, authenticated, service_role;

ALTER TABLE public.attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to attributes" ON public.attributes;
CREATE POLICY "Allow all access to attributes" ON public.attributes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to units" ON public.units;
CREATE POLICY "Allow all access to units" ON public.units FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
