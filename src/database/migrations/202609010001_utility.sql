-- Contact channels and surge pricing caps (admin-editable key-value rows)
CREATE TABLE IF NOT EXISTS public.utility (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_utility_updated_at
  ON public.utility (updated_at DESC);

INSERT INTO public.utility (key, value) VALUES
  ('whatsapp_number', ''),
  ('call_line', ''),
  ('surge_price', '0'),
  ('surge_percentage', '0')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
