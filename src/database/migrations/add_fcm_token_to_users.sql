-- Migration to add fcm_token column to users table
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
