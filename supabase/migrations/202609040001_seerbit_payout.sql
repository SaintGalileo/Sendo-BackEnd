-- Add payout account columns to merchants table
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_name TEXT;

NOTIFY pgrst, 'reload schema';
