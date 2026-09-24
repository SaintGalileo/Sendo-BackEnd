-- ========================================================
-- Add payment_reference to orders (Paystack / online pay)
-- Keep `notes` for customer rider instructions only.
-- ========================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_payment_reference
ON public.orders (payment_reference)
WHERE payment_reference IS NOT NULL;

COMMENT ON COLUMN public.orders.payment_reference IS
'External payment gateway reference (e.g. Paystack). Not shown as customer notes.';
