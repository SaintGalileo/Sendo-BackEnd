-- Key-value store for admin business-settings (modules, FCM, SMS, CMS pages, etc.)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at
  ON public.admin_settings (updated_at DESC);
