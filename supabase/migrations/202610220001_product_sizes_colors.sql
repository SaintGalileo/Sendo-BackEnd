-- Product variants: sizes and colors (e.g. shoes, bags, clothes)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
