-- Mirror of supabase/migrations/202608300002_merchant_verification.sql

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;

UPDATE public.merchants
SET status = 'pending_verification'
WHERE lower(status) IN ('pending', 'requested');

UPDATE public.merchants
SET status = 'verified',
    verified_at = COALESCE(verified_at, NOW())
WHERE lower(status) IN ('active', 'approved');

ALTER TABLE public.merchants ALTER COLUMN status SET DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);

NOTIFY pgrst, 'reload schema';
