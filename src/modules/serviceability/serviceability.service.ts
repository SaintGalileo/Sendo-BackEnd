import { supabase } from '../../config/supabase';
import {
    DEFAULT_MAX_MARKET_RADIUS_KM,
    haversineDistanceKm,
    normalizePolygonRing,
    pointInPolygon,
} from '../../common/utils/geo.util';

export type ServiceabilityResult = {
    serviceable: boolean;
    city: string | null;
    zone: string | null;
    zone_id?: string | null;
    reason?: string;
};

export class ServiceabilityService {
    /**
     * Check whether Sendo operates at the given delivery coordinates.
     * 1) Active zone polygons (point-in-polygon)
     * 2) Fallback: any verified merchant within delivery_config.max_delivery_radius_km
     */
    async check(lat: number, lng: number): Promise<ServiceabilityResult> {
        if (isNaN(lat) || isNaN(lng)) {
            return {
                serviceable: false,
                city: null,
                zone: null,
                reason: 'Invalid coordinates',
            };
        }

        const point = { lat, lng };

        const zoneHit = await this.checkZones(point);
        if (zoneHit) {
            return zoneHit;
        }

        // No usable zone polygons → fallback to merchant proximity
        return this.checkMerchantFallback(point);
    }

    private async checkZones(point: { lat: number; lng: number }): Promise<ServiceabilityResult | null> {
        const { data: zones, error } = await supabase
            .from('zones')
            .select('id, name, status, coordinates')
            .eq('status', true);

        if (error || !zones || zones.length === 0) {
            return null;
        }

        let hadValidPolygon = false;

        for (const zone of zones) {
            const ring = normalizePolygonRing(zone.coordinates);
            if (!ring) continue;
            hadValidPolygon = true;
            if (pointInPolygon(point, ring)) {
                return {
                    serviceable: true,
                    city: this.inferCityFromZoneName(zone.name),
                    zone: zone.name || null,
                    zone_id: zone.id,
                };
            }
        }

        // Zones exist but none had parseable polygons → treat as no zones, use fallback
        if (!hadValidPolygon) {
            return null;
        }

        // Valid zones exist and point is outside all of them
        return {
            serviceable: false,
            city: null,
            zone: null,
            reason: 'Outside active delivery zones',
        };
    }

    private async checkMerchantFallback(point: { lat: number; lng: number }): Promise<ServiceabilityResult> {
        const maxRadius = await this.getMaxMarketRadiusKm();

        const { data: merchants, error } = await supabase
            .from('merchants')
            .select('id, city, latitude, longitude')
            .or('verification_status.eq.verified,verified.eq.true')
            .not('status', 'in', '("suspended","banned","deleted","rejected")')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .limit(500);

        if (error || !merchants || merchants.length === 0) {
            return {
                serviceable: false,
                city: null,
                zone: null,
                reason: 'No merchants available',
            };
        }

        let nearest: { city: string | null; distance: number } | null = null;

        for (const m of merchants) {
            const mLat = Number(m.latitude);
            const mLng = Number(m.longitude);
            if (isNaN(mLat) || isNaN(mLng)) continue;
            const dist = haversineDistanceKm(point, { lat: mLat, lng: mLng });
            if (dist > maxRadius) continue;
            if (!nearest || dist < nearest.distance) {
                nearest = { city: m.city || null, distance: dist };
            }
        }

        if (!nearest) {
            return {
                serviceable: false,
                city: null,
                zone: null,
                reason: 'No merchants within service radius',
            };
        }

        return {
            serviceable: true,
            city: nearest.city,
            zone: null,
        };
    }

    private async getMaxMarketRadiusKm(): Promise<number> {
        try {
            const { data } = await supabase
                .from('delivery_config')
                .select('max_delivery_radius_km')
                .limit(1)
                .maybeSingle();
            const n = Number(data?.max_delivery_radius_km);
            if (!isNaN(n) && n > 0) return n;
        } catch {
            // ignore
        }
        return DEFAULT_MAX_MARKET_RADIUS_KM;
    }

    private inferCityFromZoneName(name?: string | null): string | null {
        if (!name) return null;
        // e.g. "Calabar Municipal" → "Calabar"
        const first = name.trim().split(/\s+/)[0];
        return first || name;
    }
}
