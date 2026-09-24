/**
 * Shared geo helpers for store discovery and serviceability.
 * Keep Haversine here so StoresService and LocationService can share the same math later.
 */

export type LatLng = { lat: number; lng: number };

export const DEFAULT_MERCHANT_DELIVERY_RADIUS_KM = 15;
export const DEFAULT_MAX_MARKET_RADIUS_KM = 50;

/** Great-circle distance in kilometers. */
export function haversineDistanceKm(p1: LatLng, p2: LatLng): number {
    const R = 6371;
    const dLat = deg2rad(p2.lat - p1.lat);
    const dLng = deg2rad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(p1.lat)) * Math.cos(deg2rad(p2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Normalize zone.coordinates jsonb into a ring of {lat,lng}.
 * Supports:
 * - [{lat,lng}|{latitude,longitude}|{lat,lon}, ...]
 * - [[lat,lng]|[lng,lat], ...] (heuristic: |value|<=90 is lat when ambiguous)
 * - GeoJSON Polygon / MultiPolygon ({ type, coordinates })
 * - { paths: [...] } Google Maps style
 */
export function normalizePolygonRing(raw: unknown): LatLng[] | null {
    if (!raw) return null;

    let candidate: unknown = raw;

    if (typeof candidate === 'string') {
        try {
            candidate = JSON.parse(candidate);
        } catch {
            return null;
        }
    }

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        const obj = candidate as Record<string, unknown>;
        if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
            candidate = (obj.coordinates as unknown[])[0];
        } else if (obj.type === 'MultiPolygon' && Array.isArray(obj.coordinates)) {
            candidate = ((obj.coordinates as unknown[])[0] as unknown[])?.[0];
        } else if (Array.isArray(obj.paths)) {
            candidate = obj.paths;
        } else if (Array.isArray(obj.coordinates)) {
            candidate = obj.coordinates;
        }
    }

    if (!Array.isArray(candidate) || candidate.length < 3) return null;

    const ring: LatLng[] = [];
    for (const pt of candidate) {
        const normalized = normalizePoint(pt);
        if (!normalized) return null;
        ring.push(normalized);
    }

    if (ring.length < 3) return null;

    // Close ring if needed
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
        ring.push({ ...first });
    }

    return ring;
}

function normalizePoint(pt: unknown): LatLng | null {
    if (Array.isArray(pt) && pt.length >= 2) {
        const a = Number(pt[0]);
        const b = Number(pt[1]);
        if (isNaN(a) || isNaN(b)) return null;
        // Prefer GeoJSON [lng, lat] when |a| > 90 or |b| <= 90 with |a| typical lng
        if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
            return { lat: b, lng: a };
        }
        if (Math.abs(b) > 90 && Math.abs(a) <= 90) {
            return { lat: a, lng: b };
        }
        // Default GeoJSON: [lng, lat]
        return { lat: b, lng: a };
    }

    if (pt && typeof pt === 'object') {
        const o = pt as Record<string, unknown>;
        const lat = Number(o.lat ?? o.latitude);
        const lng = Number(o.lng ?? o.lon ?? o.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    return null;
}

/** Ray-casting point-in-polygon. Ring should be closed. */
export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
    if (!ring || ring.length < 3) return false;

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].lng;
        const yi = ring[i].lat;
        const xj = ring[j].lng;
        const yj = ring[j].lat;

        const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;

        if (intersect) inside = !inside;
    }
    return inside;
}

export function resolveMerchantDeliveryRadiusKm(
    merchantRadius: unknown,
    fallbackKm = DEFAULT_MERCHANT_DELIVERY_RADIUS_KM,
): number {
    const n = Number(merchantRadius);
    if (!isNaN(n) && n > 0) return n;
    return fallbackKm;
}
