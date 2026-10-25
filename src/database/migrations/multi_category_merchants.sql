-- Add multi-category support to merchants table.
-- A store can serve up to 10 categories (e.g. grocery AND food_restaurant).
-- The `type` column is kept for backward compatibility; `categories` is the source of truth going forward.
-- Safe to run multiple times.

BEGIN;

-- 1. Add the categories TEXT[] array column.
ALTER TABLE public.merchants
    ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- 2. Backfill: copy existing `type` into `categories` for all rows where categories is empty.
UPDATE public.merchants
SET categories = ARRAY[type]
WHERE (categories IS NULL OR categories = '{}')
  AND type IS NOT NULL AND trim(type) != '';

-- 3. Add a check constraint to ensure max 10 categories.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.merchants'::regclass
          AND conname = 'merchants_categories_max_10'
    ) THEN
        ALTER TABLE public.merchants
            ADD CONSTRAINT merchants_categories_max_10
            CHECK (array_length(categories, 1) IS NULL OR array_length(categories, 1) <= 10);
    END IF;
END $$;

-- 4. Create a GIN index for fast array overlap / contains queries.
CREATE INDEX IF NOT EXISTS idx_merchants_categories ON public.merchants USING GIN (categories);

-- 5. Notify PostgREST to reload schema cache.
NOTIFY pgrst, 'reload schema';

COMMIT;
