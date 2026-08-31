-- Admin CUD audit log + merchant store employees.
-- Mirror of: supabase/migrations/202608310001_admin_audit_and_store_employees.sql
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_label TEXT,
  reason TEXT NOT NULL,
  before JSONB,
  after JSONB,
  changes JSONB,
  actor_id UUID NOT NULL REFERENCES public.users(id),
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs (actor_id);

GRANT SELECT, INSERT ON public.admin_audit_logs TO anon, authenticated, service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "Allow all access to admin_audit_logs"
  ON public.admin_audit_logs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.merchant_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  designation TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_employees_merchant_id
  ON public.merchant_employees (merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_employees_created_at
  ON public.merchant_employees (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_employees TO anon, authenticated, service_role;

ALTER TABLE public.merchant_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to merchant_employees" ON public.merchant_employees;
CREATE POLICY "Allow all access to merchant_employees"
  ON public.merchant_employees FOR ALL USING (true) WITH CHECK (true);
