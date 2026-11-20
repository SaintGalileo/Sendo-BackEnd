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

export type RankedCourierCandidate = {
    courierId: string;
    userId: string | null;
    name: string | null;
    vehicleType: string | null;
    location: LatLng;
    straightLineKm: number;
    activeCount: number;
    rating: number;
    ageMinutes: number;
    score: number;
};

const ACTIVE_DISPATCH_STATUSES = [
    'ready_for_pickup',
    'accepted',
    'preparing',
    'picked_up',
    'on_the_way',
];

const MAX_ACTIVE_ORDERS_FOR_RANKING = 3;

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
     * Ranks eligible online couriers near a merchant for smart dispatch and fee quoting.
     * Pre-filters by bounding box and GPS freshness on courier_locations so it scales cleanly
     * even with hundreds of online riders, excludes couriers at max capacity (3 active orders)
     * or who already rejected the order, and scores by distance + active load + GPS freshness + rating.
     */
    async rankEligibleCouriersForMerchant(
        merchantPoint: LatLng,
        options?: {
            excludeOrderId?: string;
            maxDistanceKm?: number;
            staleMinutes?: number;
            limit?: number;
        },
    ): Promise<RankedCourierCandidate[]> {
        const maxDistanceKm = options?.maxDistanceKm ?? MAX_NEAREST_COURIER_PICKUP_KM;
        const staleMinutes = options?.staleMinutes ?? 15;
        const limit = options?.limit ?? 10;

        const latDelta = maxDistanceKm / 111.32;
        const cosLat = Math.max(0.2, Math.cos((merchantPoint.lat * Math.PI) / 180));
        const lngDelta = maxDistanceKm / (111.32 * cosLat);

        const fetchLocationsWithin = async (minutes: number) => {
            const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
            return supabase
                .from('courier_locations')
                .select('courier_id, lat, lng, updated_at')
                .gte('lat', merchantPoint.lat - latDelta)
                .lte('lat', merchantPoint.lat + latDelta)
                .gte('lng', merchantPoint.lng - lngDelta)
                .lte('lng', merchantPoint.lng + lngDelta)
                .gte('updated_at', cutoff)
                .order('updated_at', { ascending: false })
                .limit(500);
        };

        let { data: locationRows, error: locationsError } = await fetchLocationsWithin(staleMinutes);
        if (!locationsError && (!locationRows || locationRows.length === 0) && staleMinutes < 120) {
            // Graceful fallback to 2h window if no ultra-fresh GPS ping is present
            const fallback = await fetchLocationsWithin(120);
            locationRows = fallback.data;
            locationsError = fallback.error;
        }

        if (locationsError) {
            const msg = `${locationsError.message || ''}`.toLowerCase();
            if (
                locationsError.code === '42P01' ||
                locationsError.code === 'PGRST205' ||
                msg.includes('courier_locations')
            ) {
                console.warn('[LocationService] courier_locations table missing; skipping rider ranking.');
            } else {
                console.warn('[LocationService] Failed to query courier_locations:', locationsError.message);
            }
            return [];
        }

        if (!locationRows || locationRows.length === 0) return [];

        const locByCourierId = new Map<string, { location: LatLng; updatedAt: number }>();
        for (const row of locationRows) {
            const cid = (row as any).courier_id ? String((row as any).courier_id) : '';
            if (!cid || locByCourierId.has(cid)) continue;
            const loc = parseLatLng((row as any).lat, (row as any).lng);
            if (!loc) continue;
            const updatedAt = (row as any).updated_at ? new Date((row as any).updated_at).getTime() : Date.now();
            locByCourierId.set(cid, { location: loc, updatedAt });
        }

        const candidateIds = Array.from(locByCourierId.keys());
        if (candidateIds.length === 0) return [];

        const [couriersRes, activeOrdersRes, rejectionsRes] = await Promise.all([
            supabase
                .from('couriers')
                .select('id, user_id, name, vehicle_type, is_online, rating')
                .in('id', candidateIds)
                .eq('is_online', true),
            supabase
                .from('orders')
                .select('courier_id')
                .in('courier_id', candidateIds)
                .in('status', ACTIVE_DISPATCH_STATUSES),
            options?.excludeOrderId
                ? supabase
                      .from('courier_order_rejections')
                      .select('courier_id')
                      .eq('order_id', options.excludeOrderId)
                      .in('courier_id', candidateIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (couriersRes.error || !couriersRes.data || couriersRes.data.length === 0) {
            return [];
        }

        const activeCountMap = new Map<string, number>();
        for (const row of activeOrdersRes.data || []) {
            const cid = (row as any).courier_id ? String((row as any).courier_id) : '';
            if (!cid) continue;
            activeCountMap.set(cid, (activeCountMap.get(cid) || 0) + 1);
        }

        const rejectedSet = new Set<string>(
            (rejectionsRes.data || []).map((r: any) => String(r.courier_id)),
        );

        const now = Date.now();
        const ranked: RankedCourierCandidate[] = [];

        for (const courier of couriersRes.data as any[]) {
            const cid = String(courier.id);
            if (rejectedSet.has(cid)) continue;

            const activeCount = activeCountMap.get(cid) || 0;
            if (activeCount >= MAX_ACTIVE_ORDERS_FOR_RANKING) continue;

            const locEntry = locByCourierId.get(cid);
            if (!locEntry) continue;

            const straightLineKm = haversineDistanceKm(locEntry.location, merchantPoint);
            if (straightLineKm > maxDistanceKm) continue;

            const ageMinutes = Math.max(0, (now - locEntry.updatedAt) / 60000);
            const rating = Number(courier.rating) > 0 ? Number(courier.rating) : 4.5;

            // Composite score (lower is better): distance + load penalty + staleness penalty - rating bonus
            const score =
                straightLineKm +
                activeCount * 1.5 +
                Math.min(ageMinutes, 30) * 0.1 -
                Math.max(0, rating - 4.0) * 0.5;

            ranked.push({
                courierId: cid,
                userId: courier.user_id ? String(courier.user_id) : null,
                name: courier.name || null,
                vehicleType: courier.vehicle_type || null,
                location: locEntry.location,
                straightLineKm: round2(straightLineKm),
                activeCount,
                rating,
                ageMinutes: round2(ageMinutes),
                score: round2(score),
            });
        }

        ranked.sort((a, b) => a.score - b.score);
        return ranked.slice(0, limit);
    }

    /**
     * Finds the best eligible online courier near the merchant.
     */
    async findNearestOnlineCourierLocation(
        merchantPoint: LatLng,
    ): Promise<{ courierId: string; location: LatLng; straightLineKm: number } | null> {
        const ranked = await this.rankEligibleCouriersForMerchant(merchantPoint, { limit: 1 });
        if (ranked.length === 0) return null;
        return {
            courierId: ranked[0].courierId,
            location: ranked[0].location,
            straightLineKm: ranked[0].straightLineKm,
        };
    }
}

export const locationService = new LocationService();
