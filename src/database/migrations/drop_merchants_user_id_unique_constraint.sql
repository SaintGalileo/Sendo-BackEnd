-- Allow multiple merchant rows per user_id (merchant vendors).
-- Required for explicit merchantId selection.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'merchants_user_id_key'
          AND conrelid = 'public.merchants'::regclass
    ) THEN
        ALTER TABLE public.merchants DROP CONSTRAINT merchants_user_id_key;
    END IF;
END $$;

COMMIT;

