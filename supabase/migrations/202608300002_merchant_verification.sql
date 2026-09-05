-- Merchant verification flow: unverified signup, verification queue, rejection reason.
-- Safe to run multiple times.

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ;

-- Create merchant_verifications table
CREATE TABLE IF NOT EXISTS public.merchant_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    id_type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    is_cac_registered BOOLEAN DEFAULT false,
    cac_rc_number TEXT,
    business_legal_name TEXT,
    has_physical_store BOOLEAN DEFAULT false,
    store_address TEXT,
    store_city TEXT,
    store_state TEXT,
    landmark TEXT,
    storefront_photos TEXT[],
    storefront_photo_url TEXT,
    utility_bill_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.merchant_verifications ADD COLUMN IF NOT EXISTS storefront_photos TEXT[];
CREATE INDEX IF NOT EXISTS idx_merchant_verifications_merchant_id ON public.merchant_verifications(merchant_id);

-- Migrate legacy pending/requested → pending_verification
UPDATE public.merchants
SET status = 'pending_verification'
WHERE lower(status) IN ('pending', 'requested');

-- Already-approved merchants become verified
UPDATE public.merchants
SET status = 'verified',
    verified = true,
    verification_status = 'verified',
    verified_at = COALESCE(verified_at, NOW())
WHERE lower(status) IN ('active', 'approved');

ALTER TABLE public.merchants ALTER COLUMN status SET DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS idx_merchants_status ON public.merchants (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_verifications TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

