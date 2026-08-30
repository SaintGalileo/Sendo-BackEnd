/** DB merchant.type values for the four commercial modules. */
export const COMMERCIAL_MERCHANT_TYPES = [
    'grocery',
    'restaurant',
    'pharmacy',
    'store',
] as const;

export type MerchantType = (typeof COMMERCIAL_MERCHANT_TYPES)[number];

/**
 * Map admin module → merchants.type values used for list/dashboard filters.
 * Missing module → null (no type filter). parcel/rental → null (special paths).
 */
export function moduleToMerchantTypes(
    moduleId: string | null | undefined,
): MerchantType[] | null {
    if (moduleId == null || String(moduleId).trim() === '') return null;
    const id = String(moduleId).toLowerCase();
    switch (id) {
        case 'all':
            return [...COMMERCIAL_MERCHANT_TYPES];
        case 'grocery':
            return ['grocery'];
        case 'food':
            return ['restaurant'];
        case 'pharmacy':
            return ['pharmacy'];
        case 'shop':
            return ['store'];
        case 'parcel':
        case 'rental':
            return null;
        default:
            return null;
    }
}

/** True when module should apply commercial merchant-type filtering. */
export function isCommercialModule(moduleId: string | null | undefined): boolean {
    const id = String(moduleId || '').toLowerCase();
    return id === 'all' || id === 'grocery' || id === 'food' || id === 'pharmacy' || id === 'shop';
}

/** Parse zone key "City|State" into city/state filters. */
export function parseZoneKey(zone: string | null | undefined): {
    city?: string;
    state?: string;
} {
    const raw = String(zone || '').trim();
    if (!raw || raw === 'all') return {};
    const pipe = raw.indexOf('|');
    if (pipe === -1) {
        return { city: raw };
    }
    const city = raw.slice(0, pipe).trim();
    const state = raw.slice(pipe + 1).trim();
    const out: { city?: string; state?: string } = {};
    if (city) out.city = city;
    if (state) out.state = state;
    return out;
}

export function zoneKeyFromCityState(city: string, state?: string | null): string {
    const c = String(city || '').trim();
    const s = String(state || '').trim();
    return s ? `${c}|${s}` : c;
}
