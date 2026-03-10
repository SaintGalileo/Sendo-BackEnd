-- SQL Migration: Catalog Management
-- These queries ensure that the categories and products tables have the necessary columns for the merchant flow.

-- 1. Categories Table
-- Ensure merchant_id is present and points to the merchants table
-- If the table doesn't have description, let's add it.

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Products Table
-- Ensure image_url, description, and is_available are present.
-- Ensure relationship to categories and merchants.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);

-- Note: In a real Supabase environment, you would also set up RLS (Row Level Security) 
-- to ensure merchants can only modify their own items.
-- Example:
-- CREATE POLICY "Merchants can manage their own products" 
-- ON products FOR ALL 
-- TO authenticated
-- USING (merchant_id = (SELECT id FROM merchants WHERE user_id = auth.uid()));
