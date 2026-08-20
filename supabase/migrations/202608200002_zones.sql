-- Create business zones (with Google Maps polygon coordinates)
CREATE TABLE IF NOT EXISTS public.zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status boolean NOT NULL DEFAULT true,
    coordinates jsonb,
    vendors integer NOT NULL DEFAULT 0,
    deliverymen integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS status boolean DEFAULT true;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS coordinates jsonb;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS vendors integer DEFAULT 0;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS deliverymen integer DEFAULT 0;
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_zones_created_at ON public.zones (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zones_status ON public.zones (status);
