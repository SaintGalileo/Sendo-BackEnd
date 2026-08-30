-- Inbound contact-form messages for admin inbox
-- (Users → Contact Messages / /admin/message/list).
-- Safe to run multiple times. Backend uses SUPABASE_ANON_KEY — anon needs CRUD.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  phone TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read
  ON public.contact_messages (is_read);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages
  TO anon, authenticated, service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to contact_messages" ON public.contact_messages;
CREATE POLICY "Allow all access to contact_messages"
  ON public.contact_messages FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
