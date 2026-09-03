/** DB `merchants.type` values for commercial merchants (25-category taxonomy). */
export const COMMERCIAL_MERCHANT_TYPES = [
    'supermarket_groceries',
    'food_restaurant',
    'bakery_confectionery',
    'pharmacy_healthcare',
    'beauty_personal_care',
    'fashion_clothing',
    'shoes_bags',
    'jewellery_accessories',
    'electronics_gadgets',
    'phones_computers',
    'home_living',
    'baby_kids',
    'sports_fitness',
    'books_stationery',
    'automotive',
    'hardware_building',
    'agriculture_farm_supplies',
    'pet_supplies',
    'gifts_speciality',
    'alcohol_beverages',
    'office_business_supplies',
    'local_specialty_products',
    'services',
    'wholesale_bulk',
    'other',
] as const;

export type MerchantType = (typeof COMMERCIAL_MERCHANT_TYPES)[number];

const COMMERCIAL_SET = new Set(COMMERCIAL_MERCHANT_TYPES as readonly string[]);

/**
 * Map admin module → merchants.type values used for list/dashboard filters.
 * Missing module → null (no type filter). parcel/rental → null (special paths).
 */
export function moduleToMerchantTypes(
    moduleId: string | null | undefined,
): MerchantType[] | null {
    if (moduleId == null || String(moduleId).trim() === '') return null;
    const id = String(moduleId).toLowerCase();
    if (id === 'all') return [...COMMERCIAL_MERCHANT_TYPES];

    // Special paths: parcel/rental do not restrict merchant.type.
    if (id === 'parcel' || id === 'rental') return null;

    if (COMMERCIAL_SET.has(id)) return [id as MerchantType];
    return null;
}

/** True when module should apply commercial merchant-type filtering. */
export function isCommercialModule(moduleId: string | null | undefined): boolean {
    const id = String(moduleId || '').toLowerCase();
    return id === 'all' || COMMERCIAL_SET.has(id);
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
