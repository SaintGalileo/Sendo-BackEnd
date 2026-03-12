-- SQL Migration: Product Add-ons (Extras)
-- This script creates the structure for products to have customizable extras/add-ons.

-- 1. Create Extra Groups Table
-- Defines a group of options like "Select Protein" or "Takeaway"
CREATE TABLE IF NOT EXISTS product_extra_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    selection_type TEXT DEFAULT 'single' CHECK (selection_type IN ('single', 'multiple')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Extra Options Table
-- Defines individual choices within a group like "Beef", "Chicken", "Plastic Container"
CREATE TABLE IF NOT EXISTS product_extra_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extra_group_id UUID NOT NULL REFERENCES product_extra_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enable RLS (Optional but recommended for Supabase)
ALTER TABLE product_extra_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_extra_options ENABLE ROW LEVEL SECURITY;

-- Basic policy: authenticated users can read, merchants can manage (simplified)
-- In a real scenario, you'd check if the merchant owns the product.
CREATE POLICY "Allow public read access for extra groups" ON product_extra_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read access for extra options" ON product_extra_options FOR SELECT USING (true);
