-- Migration to add account fields to wallets table for SeerBit integration
ALTER TABLE IF EXISTS wallets 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_name TEXT,
ADD COLUMN IF NOT EXISTS reference TEXT;

-- Index for faster lookups by account number and reference
CREATE INDEX IF NOT EXISTS idx_wallets_account_number ON wallets(account_number);
CREATE INDEX IF NOT EXISTS idx_wallets_reference ON wallets(reference);
