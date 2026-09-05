-- Add push_id column to merchants table for device push notifications
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS push_id TEXT;

-- Create index for fast lookups by push_id
CREATE INDEX IF NOT EXISTS idx_merchants_push_id ON public.merchants (push_id);

NOTIFY pgrst, 'reload schema';
