-- Super-admin privilege hierarchy
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON public.users (is_super_admin) WHERE is_super_admin = true;

-- Promote the existing seeded admin to super-admin
UPDATE public.users
SET is_super_admin = true
WHERE email = 'enwonontuk20@gmail.com'
  AND is_admin = true;
