import { createHash } from 'crypto';
import { supabase } from '../../config/supabase';
import { isMerchantAvailable } from '../../common/utils/helpers';
import {
    DEFAULT_MERCHANT_DELIVERY_RADIUS_KM,
    haversineDistanceKm,
    resolveMerchantDeliveryRadiusKm,
} from '../../common/utils/geo.util';
import { COMMERCIAL_MERCHANT_TYPES } from '../admin/moduleMerchantTypes';

function uncategorizedCategoryId(merchantId: string): string {
    const hex = createHash('sha1').update(`sendo:uncategorized:${merchantId}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const TYPE_ALIAS_MAP: Record<string, string[]> = {
    restaurant: ['restaurant', 'food_restaurant', 'bakery_confectionery'],
    food: ['restaurant', 'food_restaurant', 'bakery_confectionery'],
    food_restaurant: ['restaurant', 'food_restaurant', 'bakery_confectionery'],
    grocery: ['grocery', 'supermarket_groceries', 'agriculture_farm_supplies', 'local_specialty_products'],
    groceries: ['grocery', 'supermarket_groceries', 'agriculture_farm_supplies', 'local_specialty_products'],
    supermarket_groceries: ['grocery', 'supermarket_groceries', 'agriculture_farm_supplies', 'local_specialty_products'],
    pharmacy: ['pharmacy', 'pharmacy_healthcare', 'beauty_personal_care'],
    pharmacy_healthcare: ['pharmacy', 'pharmacy_healthcare', 'beauty_personal_care'],
    store: ['store', 'other', 'general', ...COMMERCIAL_MERCHANT_TYPES],
};

/** Cap for in-memory geo filter pool (MVP scale). */
const GEO_POOL_LIMIT = 500;
/** Soft shuffle only among the nearest N featured stores. */
const FEATURED_SHUFFLE_POOL = 20;

function applyTypeFilter(query: any, type?: string) {
    if (!type || type === 'all') return query;
    const clean = type.toLowerCase().trim();
    if (TYPE_ALIAS_MAP[clean]) {
        return query.in('type', TYPE_ALIAS_MAP[clean]);
    }
    return query.eq('type', type);
}

function annotateAvailability(stores: any[]) {
    return (stores || []).map((store) => ({
        ...store,
        is_available: isMerchantAvailable(store),
    }));
}

export class StoresService {
    private readonly allowedStoreTypes = COMMERCIAL_MERCHANT_TYPES;

    async getStores(filters: any, pagination: any) {
        const hasGeo = filters.lat != null && filters.lng != null &&
            !isNaN(parseFloat(filters.lat)) && !isNaN(parseFloat(filters.lng));

        let query = supabase
            .from('merchants')
            .select('*', { count: 'exact' })
            .or('verification_status.eq.verified,verified.eq.true')
            .not('status', 'in', '("suspended","banned","deleted","rejected")');

        if (filters.type) {
            query = applyTypeFilter(query, filters.type);
        }

        if (filters.rating) {
            query = query.gte('rating', parseFloat(filters.rating));
        }

        if (filters.city) {
            query = query.ilike('city', `%${filters.city}%`);
        }

        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        // When geo filtering, fetch a pool first, filter by delivery_radius, then paginate.
        if (hasGeo) {
            query = query.limit(GEO_POOL_LIMIT);
            const { data, error } = await query;
            if (error) throw new Error(error.message);

            const userLat = parseFloat(filters.lat);
            const userLng = parseFloat(filters.lng);
            const sorted = this.filterAndSortByDeliveryReach(
                annotateAvailability(data || []),
                userLat,
                userLng,
            );

            const from = pagination.offset;
            const to = from + pagination.limit;
            return {
                data: sorted.slice(from, to),
                totalCount: sorted.length,
            };
        }

        const from = pagination.offset;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        return {
            data: annotateAvailability(data || []),
            totalCount: count || 0,
        };
    }

    /**
     * Nearby stores for a delivery pin.
     * Prefers explicit lat/lng (selected delivery address). Falls back to DB default address.
     */
    async getNearbyStores(
        userId: string,
        pagination: any,
        type?: string,
        lat?: string,
        lng?: string,
        addressId?: string,
    ) {
        const coords = await this.resolveDeliveryCoords(userId, lat, lng, addressId);
        if (!coords) {
            throw new Error('No delivery address found. Please set a delivery address.');
        }

        return this.getStores(
            {
                lat: String(coords.lat),
                lng: String(coords.lng),
                type,
            },
            pagination,
        );
    }

    async getFeaturedStores(pagination: any, lat?: string, lng?: string, type?: string) {
        let query = supabase
            .from('merchants')
            .select('*')
            .or('verification_status.eq.verified,verified.eq.true')
            .not('status', 'in', '("suspended","banned","deleted","rejected")');

        if (type) {
            query = applyTypeFilter(query, type);
        }

        const { data, error } = await query.limit(GEO_POOL_LIMIT);
        if (error) throw new Error(error.message);

        let stores = annotateAvailability(data || []);

        if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            stores = this.filterAndSortByDeliveryReach(stores, parseFloat(lat), parseFloat(lng));
            // Soft shuffle among nearest only — keeps local relevance
            const near = stores.slice(0, FEATURED_SHUFFLE_POOL);
            const rest = stores.slice(FEATURED_SHUFFLE_POOL);
            for (let i = near.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [near[i], near[j]] = [near[j], near[i]];
            }
            stores = [...near, ...rest];
        } else {
            stores = stores.sort(() => Math.random() - 0.5);
        }

        const from = pagination.offset;
        const to = from + pagination.limit;
        return {
            data: stores.slice(from, to),
            totalCount: stores.length,
        };
    }

    async getStoresByCity(
        userId: string,
        pagination: any,
        type?: string,
        lat?: string,
        lng?: string,
        addressId?: string,
    ) {
        const coords = await this.resolveDeliveryCoords(userId, lat, lng, addressId);
        if (!coords) {
            throw new Error('No delivery address found. Please set a delivery address.');
        }

        return this.getStores(
            {
                city: coords.city,
                lat: String(coords.lat),
                lng: String(coords.lng),
                type,
            },
            pagination,
        );
    }

    async getStoreById(storeId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('id', storeId)
            .single();

        if (error) throw new Error(error.message);

        const isVerified = data?.verification_status === 'verified' || data?.verified === true;
        if (!data || !isVerified) {
            throw new Error('Store is not verified or currently unavailable.');
        }

        return {
            ...data,
            is_available: isMerchantAvailable(data),
        };
    }

    async getStoreMenu(storeId: string) {
        const [{ data: categories, error: catErr }, { data: allProducts, error: prodErr }] =
            await Promise.all([
                supabase
                    .from('categories')
                    .select(
                        '*, products(*, extra_groups:product_extra_groups(*, options:product_extra_options(*)))',
                    )
                    .eq('merchant_id', storeId)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('products')
                    .select(
                        '*, extra_groups:product_extra_groups(*, options:product_extra_options(*))',
                    )
                    .eq('merchant_id', storeId)
                    .order('created_at', { ascending: false }),
            ]);

        if (catErr) throw new Error(catErr.message);
        if (prodErr) throw new Error(prodErr.message);

        const menu = [...(categories || [])];
        const nestedIds = new Set<string>();
        for (const cat of menu) {
            for (const p of (cat as { products?: { id?: string }[] }).products || []) {
                if (p?.id) nestedIds.add(String(p.id));
            }
        }
        const orphans = (allProducts || []).filter((p: { id?: string }) => !nestedIds.has(String(p.id)));
        if (orphans.length > 0) {
            menu.push({
                id: uncategorizedCategoryId(storeId),
                merchant_id: storeId,
                name: 'Uncategorized',
                description: null,
                products: orphans,
            } as any);
        }
        return menu;
    }

    async getStoreCategories(storeId: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('merchant_id', storeId);

        if (error) throw new Error(error.message);
        return data;
    }

    async getStoreProducts(storeId: string, pagination: any) {
        const from = pagination.offset;
        const to = from + pagination.limit - 1;

        const { data, count, error } = await supabase
            .from('products')
            .select('*, extra_groups:product_extra_groups(*, options:product_extra_options(*))', { count: 'exact' })
            .eq('merchant_id', storeId)
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    /**
     * Keep stores that can deliver to the pin using merchant.delivery_radius
     * (fallback DEFAULT_MERCHANT_DELIVERY_RADIUS_KM), sorted by distance.
     */
    private filterAndSortByDeliveryReach(stores: any[], userLat: number, userLng: number) {
        const user = { lat: userLat, lng: userLng };

        return stores
            .map((store) => {
                const mLat = Number(store.latitude);
                const mLng = Number(store.longitude);
                if (isNaN(mLat) || isNaN(mLng)) {
                    return { ...store, distance: Infinity };
                }
                const dist = haversineDistanceKm(user, { lat: mLat, lng: mLng });
                const radius = resolveMerchantDeliveryRadiusKm(
                    store.delivery_radius,
                    DEFAULT_MERCHANT_DELIVERY_RADIUS_KM,
                );
                return { ...store, distance: Math.round(dist * 100) / 100, _radius: radius };
            })
            .filter((store) => store.distance <= store._radius)
            .sort((a, b) => a.distance - b.distance)
            .map(({ _radius, ...store }) => store);
    }

    private async resolveDeliveryCoords(
        userId: string,
        lat?: string,
        lng?: string,
        addressId?: string,
    ): Promise<{ lat: number; lng: number; city?: string } | null> {
        const qLat = lat != null ? parseFloat(lat) : NaN;
        const qLng = lng != null ? parseFloat(lng) : NaN;

        if (!isNaN(qLat) && !isNaN(qLng)) {
            let city: string | undefined;
            if (addressId) {
                const { data: addr } = await supabase
                    .from('addresses')
                    .select('city')
                    .eq('id', addressId)
                    .eq('user_id', userId)
                    .maybeSingle();
                city = addr?.city || undefined;
            }
            return { lat: qLat, lng: qLng, city };
        }

        let query = supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId);

        if (addressId) {
            query = query.eq('id', addressId);
        } else {
            query = query.order('is_default', { ascending: false });
        }

        const { data: addresses, error } = await query;
        if (error || !addresses || addresses.length === 0) return null;

        const address = addresses[0];
        const aLat = Number(address.latitude);
        const aLng = Number(address.longitude);
        if (isNaN(aLat) || isNaN(aLng)) return null;

        return { lat: aLat, lng: aLng, city: address.city || undefined };
    }
}
