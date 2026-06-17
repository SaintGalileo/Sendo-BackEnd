-- Expand merchant/store categories to support broader vendor onboarding.
-- Safe to run multiple times.

BEGIN;

-- Ensure a type column exists and normalize existing rows.
ALTER TABLE IF EXISTS public.merchants
    ADD COLUMN IF NOT EXISTS type TEXT;

UPDATE public.merchants
SET type = 'store'
WHERE type IS NULL OR trim(type) = '';

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
    CHECK (type IN ('restaurant', 'grocery', 'pharmacy', 'store'));

COMMIT;
