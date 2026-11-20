-- DoorDash-standard idempotent settlement ledger and atomic merchant balance RPC.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.merchant_earning_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  stage TEXT NOT NULL DEFAULT 'delivery',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT merchant_earning_entries_order_id_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_earning_entries_merchant_id
  ON public.merchant_earning_entries (merchant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_earnings_order_id_unique
  ON public.courier_earnings (order_id)
  WHERE order_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_earning_entries TO anon, authenticated, service_role;
ALTER TABLE public.merchant_earning_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to merchant_earning_entries" ON public.merchant_earning_entries;
CREATE POLICY "Allow all access to merchant_earning_entries"
  ON public.merchant_earning_entries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_proof_method TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.increment_merchant_earnings(
  p_merchant_id UUID,
  p_amount NUMERIC
)
RETURNS TABLE (
  id UUID,
  merchant_id UUID,
  total_earnings NUMERIC,
  current_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.merchant_earnings (merchant_id, total_earnings, current_balance)
  VALUES (p_merchant_id, p_amount, p_amount)
  ON CONFLICT (merchant_id)
  DO UPDATE SET
    total_earnings = COALESCE(public.merchant_earnings.total_earnings, 0) + p_amount,
    current_balance = COALESCE(public.merchant_earnings.current_balance, 0) + p_amount,
    updated_at = NOW();

  RETURN QUERY
    SELECT me.id, me.merchant_id, me.total_earnings, me.current_balance
    FROM public.merchant_earnings me
    WHERE me.merchant_id = p_merchant_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
