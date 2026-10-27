-- ========================================================
-- Migration: Order Handover & Delivery Evidence Table
-- ========================================================
-- Highly scalable table to track proof-of-handover & proof-of-delivery photos
-- across merchants, couriers, and customers.

CREATE TABLE IF NOT EXISTS public.order_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('merchant', 'courier', 'customer', 'admin')),
    actor_id UUID,
    stage VARCHAR(50) NOT NULL CHECK (stage IN (
        'merchant_handover_courier',
        'merchant_handover_customer',
        'courier_pickup',
        'courier_delivery',
        'customer_dispute',
        'admin_audit'
    )),
    image_url TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_order_evidence_order_id ON public.order_evidence(order_id);
CREATE INDEX IF NOT EXISTS idx_order_evidence_stage ON public.order_evidence(stage);
CREATE INDEX IF NOT EXISTS idx_order_evidence_actor ON public.order_evidence(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_order_evidence_created_at ON public.order_evidence(created_at);

-- Add convenience direct columns on public.orders for instant zero-join reads
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS merchant_handover_image TEXT,
ADD COLUMN IF NOT EXISTS courier_delivery_image TEXT,
ADD COLUMN IF NOT EXISTS evidence_metadata JSONB DEFAULT '{}'::jsonb;

-- Storage Bucket for Evidence Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-evidence', 'order-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read order-evidence" ON storage.objects;
CREATE POLICY "Public read order-evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-evidence');

DROP POLICY IF EXISTS "Public upload order-evidence" ON storage.objects;
CREATE POLICY "Public upload order-evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'order-evidence');

DROP POLICY IF EXISTS "Public update order-evidence" ON storage.objects;
CREATE POLICY "Public update order-evidence"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'order-evidence');

-- Explanatory comments
COMMENT ON TABLE public.order_evidence IS 'Scalable log of evidence & photo proof taken during order handovers and deliveries.';
COMMENT ON COLUMN public.orders.merchant_handover_image IS 'Photo taken by merchant when handing order to courier or customer.';
COMMENT ON COLUMN public.orders.courier_delivery_image IS 'Photo taken by courier upon delivering order to customer.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

