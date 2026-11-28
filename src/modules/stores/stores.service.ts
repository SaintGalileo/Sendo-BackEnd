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
    // Food & Dining
    restaurant: ['restaurant', 'food_restaurant'],
    food: ['restaurant', 'food_restaurant'],
    food_restaurant: ['restaurant', 'food_restaurant'],

    // Bakery
    bakery: ['bakery_confectionery'],
    bakery_confectionery: ['bakery_confectionery'],

    // Supermarket & Groceries
    grocery: ['grocery', 'supermarket_groceries'],
    groceries: ['grocery', 'supermarket_groceries'],
    supermarket: ['grocery', 'supermarket_groceries'],
    supermarket_groceries: ['grocery', 'supermarket_groceries'],
    'fruits-vegetables': ['supermarket_groceries', 'agriculture_farm_supplies'],
    'meat-seafood': ['supermarket_groceries'],
    'household-cleaning': ['supermarket_groceries', 'home_living'],

    // Pharmacy & Health
    pharmacy: ['pharmacy', 'pharmacy_healthcare'],
    pharmacy_healthcare: ['pharmacy', 'pharmacy_healthcare'],

    // Drinks & Alcohol
    wine: ['alcohol_beverages'],
    drinks: ['alcohol_beverages'],
    alcohol: ['alcohol_beverages'],
    alcohol_beverages: ['alcohol_beverages'],

    // Fashion & Accessories
    fashion: ['fashion_clothing', 'shoes_bags', 'jewellery_accessories'],
    fashion_clothing: ['fashion_clothing'],
    'shoes-footwear': ['shoes_bags'],
    shoes_bags: ['shoes_bags'],
    'jewelry-accessories': ['jewellery_accessories'],
    jewellery_accessories: ['jewellery_accessories'],

    // Tech & Electronics
    electronics: ['electronics_gadgets', 'phones_computers'],
    electronics_gadgets: ['electronics_gadgets'],
    'phones-tablets': ['phones_computers'],
    'phones-accessories': ['phones_computers', 'electronics_gadgets'],
    'computer-accessories': ['phones_computers', 'electronics_gadgets'],
    gaming: ['electronics_gadgets'],
    phones_computers: ['phones_computers'],

    // Home & Living
    'home-kitchen': ['home_living'],
    'home-living': ['home_living'],
    furniture: ['home_living'],
    home_living: ['home_living'],

    // Beauty & Care
    beauty: ['beauty_personal_care'],
    'beauty-cosmetics': ['beauty_personal_care'],
    'skincare-beauty': ['beauty_personal_care'],
    'makeup-cosmetics': ['beauty_personal_care'],
    beauty_personal_care: ['beauty_personal_care'],

    // Baby & Kids
    'baby-kids': ['baby_kids'],
    baby_kids: ['baby_kids'],

    // Pet Supplies
    'pet-supplies': ['pet_supplies'],
    pet_supplies: ['pet_supplies'],

    // Sports & Fitness
    'sports-fitness': ['sports_fitness'],
    sports_fitness: ['sports_fitness'],

    // Books & Stationery
    'books-stationery': ['books_stationery'],
    books_stationery: ['books_stationery'],

    // Automotive
    automotive: ['automotive'],

    // Hardware & Building
    'hardware-tools': ['hardware_building'],
    hardware_building: ['hardware_building'],

    // Agro & Farm
    'agro-market': ['agriculture_farm_supplies'],
    agriculture_farm_supplies: ['agriculture_farm_supplies'],

    // Gifts & Flowers
    'gifts-flowers': ['gifts_speciality'],
    'flowers-gifts': ['gifts_speciality'],
    gifts_speciality: ['gifts_speciality'],

    // Business & Specialty
    office_business_supplies: ['office_business_supplies'],
    local_specialty_products: ['local_specialty_products'],
    services: ['services'],
    wholesale_bulk: ['wholesale_bulk'],

    // General Retail Store
    store: ['store', 'other', 'general'],
    stores: ['store', 'other', 'general'],
    other: ['other'],
};

/** Cap for in-memory geo filter pool (MVP scale). */
const GEO_POOL_LIMIT = 500;
/** Soft shuffle only among the nearest N featured stores. */
const FEATURED_SHUFFLE_POOL = 20;
/** Short TTL cache for the featured merchant pool (per type). */
const FEATURED_POOL_TTL_MS = 30_000;
const featuredPoolCache = new Map<string, { at: number; promise: Promise<any[]> }>();

function applyTypeFilter(query: any, type?: string) {
    if (!type || type === 'all') return query;
    const clean = type.toLowerCase().trim();
    const types = TYPE_ALIAS_MAP[clean] || [type];
    // Filter using both the new categories array column (overlap) and legacy type column.
    // `categories.ov.{...}` checks if the merchant's categories array overlaps with the requested types.
    const catFilter = `categories.ov.{${types.join(',')}}`;
    const typeFilter = types.map(t => `type.eq.${t}`).join(',');
    return query.or(`${catFilter},${typeFilter}`);
}

function annotateAvailability(stores: any[]) {
    return (stores || []).map((store) => ({
        ...store,
        is_available: isMerchantAvailable(store),
    }));
}

function matchesServiceArea(
    store: any,
    target: { state?: string; city?: string; area?: string; country?: string }
): boolean {
    const tState = target.state?.trim().toLowerCase();
    const tCity = target.city?.trim().toLowerCase();
    const tArea = target.area?.trim().toLowerCase();

    if (!tState && !tCity) return true;

    const areas: any[] = Array.isArray(store.service_areas) ? store.service_areas : [];
    if (areas.length > 0) {
        return areas.some((sa) => {
            if (!sa || typeof sa !== 'object') return false;
            const sState = String(sa.state || '').trim().toLowerCase();
            const sCity = String(sa.city || '').trim().toLowerCase();
            const sArea = String(sa.area || '').trim().toLowerCase();

            if (tState && sState !== tState) return false;
            if (tCity && sCity !== tCity) return false;
            // If vendor left `area` empty, they serve the whole city; otherwise match area too.
            if (tArea && sArea && sArea !== tArea) return false;
            return true;
        });
    }

    // Legacy fallback when service_areas is empty
    const mState = String(store.state || '').trim().toLowerCase();
    const mCity = String(store.city || '').trim().toLowerCase();
    const mArea = String(store.area || '').trim().toLowerCase();
    if (tState && mState !== tState) return false;
    if (tCity && mCity !== tCity) return false;
    if (tArea && mArea && mArea !== tArea) return false;
    return true;
}

export class StoresService {
    private readonly allowedStoreTypes = COMMERCIAL_MERCHANT_TYPES;

    async getStores(filters: any, pagination: any) {
        const hasManualLocation = Boolean(
            (filters.state && String(filters.state).trim()) ||
            (filters.city && String(filters.city).trim())
        );
        const hasGeo = !hasManualLocation &&
            filters.lat != null && filters.lng != null &&
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

        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        // Manual service-area filtering takes precedence over GPS radius filtering
        if (hasManualLocation) {
            query = query.limit(GEO_POOL_LIMIT);
            const { data, error } = await query;
            if (error) throw new Error(error.message);

            const filtered = annotateAvailability(data || []).filter((store) =>
                matchesServiceArea(store, {
                    state: filters.state,
                    city: filters.city,
                    area: filters.area,
                    country: filters.country,
                })
            );

            const from = pagination.offset;
            const to = from + pagination.limit;
            return {
                data: filtered.slice(from, to),
                totalCount: filtered.length,
            };
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
     * Stores for a customer's selected location.
     * Prefers explicit state/city/area, then lat/lng, then DB default address.
     */
    async getNearbyStores(
        userId: string,
        pagination: any,
        type?: string,
        lat?: string,
        lng?: string,
        addressId?: string,
        manualLoc?: { state?: string; city?: string; area?: string; country?: string },
    ) {
        if (manualLoc?.state || manualLoc?.city) {
            return this.getStores(
                {
                    state: manualLoc.state,
                    city: manualLoc.city,
                    area: manualLoc.area,
                    country: manualLoc.country,
                    type,
                },
                pagination,
            );
        }

        const resolved = await this.resolveDeliveryCoords(userId, lat, lng, addressId);
        if (!resolved) {
            throw new Error('No delivery location selected. Please choose your state and city.');
        }

        return this.getStores(
            {
                state: resolved.state,
                city: resolved.city,
                area: resolved.area,
                lat: resolved.lat != null ? String(resolved.lat) : undefined,
                lng: resolved.lng != null ? String(resolved.lng) : undefined,
                type,
            },
            pagination,
        );
    }

    async getFeaturedStores(
        pagination: any,
        lat?: string,
        lng?: string,
        type?: string,
        manualLoc?: { state?: string; city?: string; area?: string; country?: string },
    ) {
        const cacheKey = (type || 'all').toLowerCase().trim();
        let entry = featuredPoolCache.get(cacheKey);
        if (!entry || Date.now() - entry.at > FEATURED_POOL_TTL_MS) {
            let query = supabase
                .from('merchants')
                .select('*')
                .or('verification_status.eq.verified,verified.eq.true')
                .not('status', 'in', '("suspended","banned","deleted","rejected")');

            if (type) {
                query = applyTypeFilter(query, type);
            }

            const promise = (async () => {
                const { data: rows, error: err } = await query.limit(GEO_POOL_LIMIT);
                if (err) throw new Error(err.message);
                return rows || [];
            })();
            entry = { at: Date.now(), promise };
            featuredPoolCache.set(cacheKey, entry);
            promise.catch(() => featuredPoolCache.delete(cacheKey));
        }
        const data = await entry.promise;

        let stores = annotateAvailability(data || []);

        if (manualLoc?.state || manualLoc?.city) {
            stores = stores.filter((store) => matchesServiceArea(store, manualLoc));
            for (let i = stores.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [stores[i], stores[j]] = [stores[j], stores[i]];
            }
        } else if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            stores = this.filterAndSortByDeliveryReach(stores, parseFloat(lat), parseFloat(lng));
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
        manualLoc?: { state?: string; city?: string; area?: string; country?: string },
    ) {
        if (manualLoc?.state || manualLoc?.city) {
            return this.getStores(
                {
                    state: manualLoc.state,
                    city: manualLoc.city,
                    area: manualLoc.area,
                    country: manualLoc.country,
                    type,
                },
                pagination,
            );
        }

        const resolved = await this.resolveDeliveryCoords(userId, lat, lng, addressId);
        if (!resolved) {
            throw new Error('No delivery location selected. Please choose your state and city.');
        }

        return this.getStores(
            {
                state: resolved.state,
                city: resolved.city,
                area: resolved.area,
                lat: resolved.lat != null ? String(resolved.lat) : undefined,
                lng: resolved.lng != null ? String(resolved.lng) : undefined,
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
    ): Promise<{ lat?: number; lng?: number; city?: string; state?: string; area?: string } | null> {
        const qLat = lat != null ? parseFloat(lat) : NaN;
        const qLng = lng != null ? parseFloat(lng) : NaN;

        if (!isNaN(qLat) && !isNaN(qLng)) {
            let city: string | undefined;
            let state: string | undefined;
            let area: string | undefined;
            if (addressId) {
                const { data: addr } = await supabase
                    .from('addresses')
                    .select('city, state, area')
                    .eq('id', addressId)
                    .eq('user_id', userId)
                    .maybeSingle();
                city = addr?.city || undefined;
                state = addr?.state || undefined;
                area = addr?.area || undefined;
            }
            return { lat: qLat, lng: qLng, city, state, area };
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
        const hasCoords = !isNaN(aLat) && !isNaN(aLng) && (aLat !== 0 || aLng !== 0);
        if (!hasCoords && !address.city && !address.state) return null;

        return {
            lat: hasCoords ? aLat : undefined,
            lng: hasCoords ? aLng : undefined,
            city: address.city || undefined,
            state: address.state || undefined,
            area: address.area || undefined,
        };
    }
}
