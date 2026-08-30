-- Merchant verification flow: unverified signup, verification queue, rejection reason.
-- Safe to run multiple times.

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;

-- Migrate legacy pending/requested → pending_verification
UPDATE public.merchants
SET status = 'pending_verification'
WHERE lower(status) IN ('pending', 'requested');

-- Already-approved merchants become verified
UPDATE public.merchants
SET status = 'verified',
    verified_at = COALESCE(verified_at, NOW())
WHERE lower(status) IN ('active', 'approved');

ALTER TABLE public.merchants ALTER COLUMN status SET DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);

NOTIFY pgrst, 'reload schema';
