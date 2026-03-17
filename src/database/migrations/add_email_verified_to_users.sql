-- Migration to add email_verified column to users table
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
