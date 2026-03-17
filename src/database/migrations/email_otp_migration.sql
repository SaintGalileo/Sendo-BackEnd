-- Migration to add email column to otps table for email verification
ALTER TABLE IF EXISTS otps ADD COLUMN IF NOT EXISTS email TEXT;

-- Index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
