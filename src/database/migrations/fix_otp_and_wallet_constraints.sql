-- Fix for Email OTP generation: make phone nullable
ALTER TABLE IF EXISTS otps ALTER COLUMN phone DROP NOT NULL;

-- Fix for Wallet Details: update user_id to reference public.users(id) instead of auth.users(id)
ALTER TABLE IF EXISTS wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;
ALTER TABLE IF EXISTS wallets ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix for Addresses: update user_id to reference public.users(id) instead of auth.users(id)
ALTER TABLE IF EXISTS addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
ALTER TABLE IF EXISTS addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Also update policies to ensure they work with the custom user ID if RLS is used
-- For wallets
DROP POLICY IF EXISTS "Users can view their own wallet" ON wallets;
CREATE POLICY "Users can view their own wallet" ON wallets FOR SELECT TO authenticated USING (user_id::text = auth.uid()::text);

-- For addresses
DROP POLICY IF EXISTS "Enable all access for users to their own addresses" ON addresses;
CREATE POLICY "Enable all access for users to their own addresses" ON addresses FOR ALL TO authenticated USING (user_id::text = auth.uid()::text);
