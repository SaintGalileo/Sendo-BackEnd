-- Align categories timestamps with admin/merchant catalog expectations.
-- Live table historically had no updated_at; selects that request it fail with:
--   column categories.updated_at does not exist
-- Safe to run multiple times.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill created_at when an older nullable column existed without a default.
UPDATE public.categories
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

UPDATE public.categories
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

NOTIFY pgrst, 'reload schema';
