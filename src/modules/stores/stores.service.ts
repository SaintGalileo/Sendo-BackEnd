import { supabase } from '../../config/supabase';
import { isMerchantAvailable } from '../../common/utils/helpers';

export class StoresService {
    private readonly allowedStoreTypes = ['restaurant', 'grocery', 'pharmacy', 'store'];

    async getStores(filters: any, pagination: any) {
        let query = supabase
            .from('merchants')
            .select('*', { count: 'exact' })
            .in('status', ['verified', 'active', 'approved']);

        if (filters.type) {
            if (!this.allowedStoreTypes.includes(filters.type)) {
                throw new Error(`Invalid store type: ${filters.type}`);
            }
            query = query.eq('type', filters.type);
        }

        if (filters.rating) {
            query = query.gte('rating', parseFloat(filters.rating));
        }

        if (filters.city) {
            query = query.ilike('city', `%${filters.city}%`);
        }

        // Search logic
        if (filters.search) {
            query = query.ilike('name', `%${filters.search}%`);
        }

        // Pagination
        const from = pagination.offset;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        let stores = (data || []).map(store => {
            const isAvailable = isMerchantAvailable(store);
            return {
                ...store,
                is_available: isAvailable
            };
        });

        if (filters.lat && filters.lng) {
            stores = this.sortByDistance(stores, parseFloat(filters.lat), parseFloat(filters.lng));
        }

        return { data: stores, totalCount: count || 0 };
    }

    async getNearbyStores(userId: string, pagination: any, type?: string) {
        const { data: addresses, error: addrError } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false });

        if (addrError || !addresses || addresses.length === 0) {
            throw new Error('No delivery address found. Please set a delivery address.');
        }

        const address = addresses[0];

        const filters = {
            lat: address.latitude?.toString(),
            lng: address.longitude?.toString(),
            type
        };

        return this.getStores(filters, pagination);
    }

    async getFeaturedStores(pagination: any, lat?: string, lng?: string, type?: string) {
        // Fetch a pool of stores to shuffle
        let query = supabase
            .from('merchants')
            .select('*', { count: 'exact' });

        if (type) {
            if (!this.allowedStoreTypes.includes(type)) {
                throw new Error(`Invalid store type: ${type}`);
            }
            query = query.eq('type', type);
        }

        const { data, count, error } = await query.limit(100);

        if (error) throw new Error(error.message);

        let stores = (data || []).map(store => {
            const isAvailable = isMerchantAvailable(store);
            return {
                ...store,
                is_available: isAvailable
            };
        });

        // Filter by distance if coordinates provided
        if (lat && lng) {
            stores = this.sortByDistance(stores, parseFloat(lat), parseFloat(lng));
        }

        // Shuffle and paginate
        const shuffled = stores.sort(() => Math.random() - 0.5);
        const from = pagination.offset;
        const to = from + pagination.limit;
        const paged = shuffled.slice(from, to);

        return { data: paged, totalCount: stores.length };
    }

    async getStoresByCity(userId: string, pagination: any, type?: string) {
        const { data: addresses, error: addrError } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false });

        if (addrError || !addresses || addresses.length === 0) {
            throw new Error('No delivery address found. Please set a delivery address.');
        }

        const address = addresses[0];

        const filters = {
            city: address.city,
            lat: address.latitude?.toString(),
            lng: address.longitude?.toString(),
            type
        };

        return this.getStores(filters, pagination);
    }

    async getStoreById(storeId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('id', storeId)
            .single();

        if (error) throw new Error(error.message);

        const isAvailable = isMerchantAvailable(data);
        return {
            ...data,
            is_available: isAvailable
        };
    }

    async getStoreMenu(storeId: string) {
        // Menu usually implies categories and their nested products
        const { data, error } = await supabase
            .from('categories')
            .select('*, products(*, extra_groups:product_extra_groups(*, options:product_extra_options(*)))')
            .eq('merchant_id', storeId);

        if (error) throw new Error(error.message);
        return data;
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

    // Basic Haversine distance formula used for local sorting and filtering
    private sortByDistance(stores: any[], userLat: number, userLng: number) {
        const MAX_RADIUS_KM = 60; // Limit results to 60km radius

        return stores
            .map(store => {
                if (!store.latitude || !store.longitude) return { ...store, distance: Infinity };
                const dist = this.getDistanceFromLatLonInKm(userLat, userLng, store.latitude, store.longitude);
                return { ...store, distance: dist };
            })
            .filter(store => store.distance <= MAX_RADIUS_KM) // Filter out stores beyond the radius
            .sort((a, b) => a.distance - b.distance);
    }

    private getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    private deg2rad(deg: number) {
        return deg * (Math.PI / 180);
    }
}
