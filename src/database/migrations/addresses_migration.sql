-- Migration: Fresh Start for Addresses Table
-- Description: Drops and recreates the addresses table with the correct schema and RLS policies.
-- Use this if you are experiencing schema cache or foreign key errors.

-- 1. CLEANUP: Remove the old table and any existing dependencies
DROP TABLE IF EXISTS addresses CASCADE;

-- 2. CREATE TABLE: Recreate with all required columns
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE SECURITY: Row Level Security is required for Supabase
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES: Allow users to only see and manage their own data
CREATE POLICY "Enable all access for users to their own addresses"
ON addresses FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. INDEXING: Speed up lookups by user_id
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- 6. TROUBLESHOOTING NOTE:
-- If you still get a 'foreign key constraint' error, it means the 'user_id' being passed 
-- from the app does not exist in your 'auth.users' table. 
-- Make sure you are testing with a user that was created via Supabase Auth.
