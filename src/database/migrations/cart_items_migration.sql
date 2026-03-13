-- SQL Migration: Cart Management
-- This script creates the cart_items table and sets up RLS policies.

-- 1. Create the cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    extras JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
-- Users can only see their own cart items
CREATE POLICY "Users can view their own cart items"
ON public.cart_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own cart items
CREATE POLICY "Users can insert their own cart items"
ON public.cart_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own cart items
CREATE POLICY "Users can update their own cart items"
ON public.cart_items FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cart items
CREATE POLICY "Users can delete their own cart items"
ON public.cart_items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Create Index for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- 5. Add a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
