-- Expand merchant/store categories to support broader vendor onboarding.
-- Safe to run multiple times.

BEGIN;

-- Ensure a type column exists and normalize existing rows.
ALTER TABLE IF EXISTS public.merchants
    ADD COLUMN IF NOT EXISTS type TEXT;

-- Normalize null/empty to a safe default.
UPDATE public.merchants
SET type = 'other'
WHERE type IS NULL OR trim(type) = '';

-- Remap legacy merchant types into the new canonical category keys.
UPDATE public.merchants
SET type = 'supermarket_groceries'
WHERE lower(trim(type)) = 'grocery';

UPDATE public.merchants
SET type = 'food_restaurant'
WHERE lower(trim(type)) = 'restaurant';

UPDATE public.merchants
SET type = 'pharmacy_healthcare'
WHERE lower(trim(type)) = 'pharmacy';

UPDATE public.merchants
SET type = 'other'
WHERE lower(trim(type)) = 'store';

-- Clamp any unknown values into `other` to keep the constraint stable.
UPDATE public.merchants
SET type = 'other'
WHERE lower(trim(type)) NOT IN (
  'supermarket_groceries',
  'food_restaurant',
  'bakery_confectionery',
  'pharmacy_healthcare',
  'beauty_personal_care',
  'fashion_clothing',
  'shoes_bags',
  'jewellery_accessories',
  'electronics_gadgets',
  'phones_computers',
  'home_living',
  'baby_kids',
  'sports_fitness',
  'books_stationery',
  'automotive',
  'hardware_building',
  'agriculture_farm_supplies',
  'pet_supplies',
  'gifts_speciality',
  'alcohol_beverages',
  'office_business_supplies',
  'local_specialty_products',
  'services',
  'wholesale_bulk',
  'other'
);

-- Remove old check constraints on merchants.type, if present.
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.merchants'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE public.merchants DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

-- Add the new allowed merchant type constraint.
ALTER TABLE public.merchants
    ADD CONSTRAINT merchants_type_check
    CHECK (type IN (
      'supermarket_groceries',
      'food_restaurant',
      'bakery_confectionery',
      'pharmacy_healthcare',
      'beauty_personal_care',
      'fashion_clothing',
      'shoes_bags',
      'jewellery_accessories',
      'electronics_gadgets',
      'phones_computers',
      'home_living',
      'baby_kids',
      'sports_fitness',
      'books_stationery',
      'automotive',
      'hardware_building',
      'agriculture_farm_supplies',
      'pet_supplies',
      'gifts_speciality',
      'alcohol_beverages',
      'office_business_supplies',
      'local_specialty_products',
      'services',
      'wholesale_bulk',
      'other'
    ));

COMMIT;
