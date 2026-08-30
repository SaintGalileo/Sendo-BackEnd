import { supabase } from '../../config/supabase';
import { moduleToMerchantTypes, parseZoneKey } from './moduleMerchantTypes';

export type ScopeFilters = {
    module?: string;
    city?: string;
    state?: string;
    zone?: string;
};

/** Normalize query/body scope into module + city/state. */
export function normalizeScope(input: ScopeFilters): {
    module?: string;
    city?: string;
    state?: string;
} {
    const fromZone = parseZoneKey(input.zone);
    return {
        module: input.module || undefined,
        city: input.city || fromZone.city,
        state: input.state || fromZone.state,
    };
}

/**
 * Resolve merchant ids matching module + city/state.
 * Returns null when no merchant-id restriction should apply (e.g. parcel/rental with no zone).
 * Returns [] when the scope matches no merchants.
 */
export async function merchantIdsForScope(input: ScopeFilters): Promise<string[] | null> {
    const { module, city, state } = normalizeScope(input);
    const types = moduleToMerchantTypes(module);
    const hasTypeFilter = types !== null;
    const hasZoneFilter = Boolean(city || state);

    if (!hasTypeFilter && !hasZoneFilter) {
        return null;
    }

    let query = supabase.from('merchants').select('id');
    if (hasTypeFilter && types) {
        query = query.in('type', types);
    }
    if (city) query = query.eq('city', city);
    if (state) query = query.eq('state', state);

    const { data, error } = await query;
    if (error) {
        console.error('merchantIdsForScope error:', error.message);
        return [];
    }
    return (data || []).map((r: { id: string }) => r.id);
}
