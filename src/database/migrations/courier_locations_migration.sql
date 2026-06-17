-- Migration: Create courier_locations table for live tracking
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.courier_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT courier_locations_courier_id_unique UNIQUE (courier_id),
    CONSTRAINT courier_locations_lat_check CHECK (lat >= -90 AND lat <= 90),
    CONSTRAINT courier_locations_lng_check CHECK (lng >= -180 AND lng <= 180)
);

CREATE INDEX IF NOT EXISTS idx_courier_locations_updated_at
    ON public.courier_locations (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_courier_locations_lat_lng
    ON public.courier_locations (lat, lng);

ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'courier_locations'
          AND policyname = 'Couriers can manage their own locations'
    ) THEN
        CREATE POLICY "Couriers can manage their own locations"
            ON public.courier_locations
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.couriers c
                    WHERE c.id = courier_locations.courier_id
                      AND c.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.couriers c
                    WHERE c.id = courier_locations.courier_id
                      AND c.user_id = auth.uid()
                )
            );
    END IF;
END $$;
