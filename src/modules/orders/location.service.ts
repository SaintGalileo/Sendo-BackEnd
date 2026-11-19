import axios from 'axios';
import dotenv from 'dotenv';
import { haversineDistanceKm } from '../../common/utils/geo.util';
import { supabase } from '../../config/supabase';

dotenv.config();

export const BASE_DELIVERY_FEE = 1000;
export const BASE_DELIVERY_DISTANCE_KM = 3;
export const PER_KM_DELIVERY_FEE = 200;
export const COURIER_EARNING_SHARE = 0.8;
export const MAX_NEAREST_COURIER_PICKUP_KM = 30;

const DISTANCE_CACHE_TTL_MS = 5 * 60 * 1000;
const DISTANCE_CACHE_MAX_ENTRIES = 1000;

export type LatLng = { lat: number; lng: number };

export type TwoLegPricing = {
    pickupDistanceKm: number;
    dropoffDistanceKm: number;
    totalDistanceKm: number;
    fee: number;
    courierEarning: number;
    includesPickupLeg: boolean;
};

export function isValidLatLng(point: unknown): point is LatLng {
    if (!point || typeof point !== 'object') return false;
    const candidate = point as Record<string, unknown>;
    const lat = candidate.lat;
    const lng = candidate.lng;
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180 &&
        !(lat === 0 && lng === 0)
    );
}

export function parseLatLng(lat: unknown, lng: unknown): LatLng | null {
    if (
        lat === null ||
        lat === undefined ||
        lat === '' ||
        lng === null ||
        lng === undefined ||
        lng === ''
    ) {
        return null;
    }
    const parsed = { lat: Number(lat), lng: Number(lng) };
    return isValidLatLng(parsed) ? parsed : null;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export class LocationService {
    private readonly googleMapsApiKey =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        '';

    private readonly distanceCache = new Map<string, { distanceKm: number; expiresAt: number }>();

    private buildDistanceCacheKey(origin: LatLng, destination: LatLng): string {
        return `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}->${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
    }

    /**
     * Calculates the distance between two points in kilometers.
     * Uses Google Distance Matrix API for accurate road distance with a short-lived TTL cache.
     */
    async calculateDistance(
        origin: LatLng,
        destination: LatLng,
        options?: { useCache?: boolean },
    ): Promise<number> {
        const useCache = options?.useCache !== false;
        const cacheKey = this.buildDistanceCacheKey(origin, destination);

        if (useCache) {
            const cached = this.distanceCache.get(cacheKey);
            if (cached) {
                if (cached.expiresAt > Date.now()) {
                    return cached.distanceKm;
                }
                this.distanceCache.delete(cacheKey);
            }
        }

        let distanceKm: number | null = null;

        if (this.googleMapsApiKey) {
            try {
                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${this.googleMapsApiKey}`;
                const response = await axios.get(url, { timeout: 5000 });

                if (response.data && response.data.rows?.[0]?.elements?.[0]?.status === 'OK') {
                    const element = response.data.rows[0].elements[0];
                    // Google returns distance in meters
                    distanceKm = element.distance.value / 1000;
                } else {
                    console.warn('Google Distance Matrix status not OK, falling back to Haversine');
                }
            } catch (error) {
                console.error('Google Distance Matrix API error, falling back to Haversine:', error);
            }
        }

        if (distanceKm === null) {
            distanceKm = haversineDistanceKm(origin, destination);
        }

        if (useCache) {
            if (this.distanceCache.size >= DISTANCE_CACHE_MAX_ENTRIES && !this.distanceCache.has(cacheKey)) {
                const oldestKey = this.distanceCache.keys().next().value;
                if (oldestKey !== undefined) {
                    this.distanceCache.delete(oldestKey);
                }
            }
            this.distanceCache.set(cacheKey, {
                distanceKm,
                expiresAt: Date.now() + DISTANCE_CACHE_TTL_MS,
            });
        }

        return distanceKm;
    }

    /**
     * Calculates the delivery fee based on distance.
     * Pricing:
     * - Base fee: 1000 Naira (covers up to 3km)
     * - Additional: 200 Naira per km after the base distance
     */
    calculateDeliveryFee(distanceKm: number): number {
        const safeDistance = Math.max(0, Number(distanceKm) || 0);

        if (safeDistance <= BASE_DELIVERY_DISTANCE_KM) {
            return BASE_DELIVERY_FEE;
        }

        const additionalDistance = safeDistance - BASE_DELIVERY_DISTANCE_KM;
        const totalFee = BASE_DELIVERY_FEE + (additionalDistance * PER_KM_DELIVERY_FEE);

        // Round to nearest hundred (e.g., 2300, 2500)
        return Math.round(totalFee / 100) * 100;
    }

    /** Calculates the courier's share (80%) of a delivery fee rounded to 2 decimals. */
    calculateCourierEarning(deliveryFee: number): number {
        return round2(Math.max(0, Number(deliveryFee) || 0) * COURIER_EARNING_SHARE);
    }

    /**
     * Calculates two-leg delivery pricing (courier -> merchant + merchant -> customer).
     * When no courier location is available, computes the merchant -> customer leg only.
     */
    async calculateTwoLegTrip(
        courierPoint: LatLng | null,
        merchantPoint: LatLng,
        customerPoint: LatLng,
        options?: { useCache?: boolean },
    ): Promise<TwoLegPricing> {
        let pickupRaw = 0;
        let dropoffRaw: number;
        let includesPickupLeg = false;

        if (isValidLatLng(courierPoint)) {
            [pickupRaw, dropoffRaw] = await Promise.all([
                this.calculateDistance(courierPoint, merchantPoint, options),
                this.calculateDistance(merchantPoint, customerPoint, options),
            ]);
            includesPickupLeg = true;
        } else {
            dropoffRaw = await this.calculateDistance(merchantPoint, customerPoint, options);
        }

        const totalRaw = pickupRaw + dropoffRaw;
        const fee = this.calculateDeliveryFee(totalRaw);
        const courierEarning = this.calculateCourierEarning(fee);

        return {
            pickupDistanceKm: round2(pickupRaw),
            dropoffDistanceKm: round2(dropoffRaw),
            totalDistanceKm: round2(totalRaw),
            fee,
            courierEarning,
            includesPickupLeg,
        };
    }

    /**
     * Finds the nearest online courier within MAX_NEAREST_COURIER_PICKUP_KM of the merchant.
     */
    async findNearestOnlineCourierLocation(
        merchantPoint: LatLng,
    ): Promise<{ courierId: string; location: LatLng; straightLineKm: number } | null> {
        const { data: onlineCouriers, error: couriersError } = await supabase
            .from('couriers')
            .select('id')
            .eq('is_online', true)
            .limit(200);

        if (couriersError || !onlineCouriers || onlineCouriers.length === 0) {
            return null;
        }

        const onlineIds = onlineCouriers.map((c: any) => c.id).filter(Boolean);
        if (onlineIds.length === 0) {
            return null;
        }

        const { data: locationRows, error: locationsError } = await supabase
            .from('courier_locations')
            .select('courier_id, lat, lng, updated_at')
            .in('courier_id', onlineIds);

        if (locationsError) {
            const msg = `${locationsError.message || ''}`.toLowerCase();
            if (
                locationsError.code === '42P01' ||
                locationsError.code === 'PGRST205' ||
                msg.includes('courier_locations')
            ) {
                console.warn('[LocationService] courier_locations table missing; skipping nearest courier lookup.');
            } else {
                console.warn('[LocationService] Failed to query courier_locations:', locationsError.message);
            }
            return null;
        }

        let best: { courierId: string; location: LatLng; straightLineKm: number } | null = null;

        for (const row of locationRows || []) {
            const loc = parseLatLng((row as any).lat, (row as any).lng);
            if (!loc || !(row as any).courier_id) continue;

            const dist = haversineDistanceKm(loc, merchantPoint);
            if (dist > MAX_NEAREST_COURIER_PICKUP_KM) continue;

            if (!best || dist < best.straightLineKm) {
                best = {
                    courierId: String((row as any).courier_id),
                    location: loc,
                    straightLineKm: dist,
                };
            }
        }

        return best;
    }
}

export const locationService = new LocationService();
