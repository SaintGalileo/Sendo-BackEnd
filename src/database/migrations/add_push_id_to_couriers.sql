-- Add push_id column to couriers table for device push notifications
ALTER TABLE public.couriers 
ADD COLUMN IF NOT EXISTS push_id TEXT;

-- Create index for fast lookups by push_id
CREATE INDEX IF NOT EXISTS idx_couriers_push_id ON public.couriers (push_id);

NOTIFY pgrst, 'reload schema';
