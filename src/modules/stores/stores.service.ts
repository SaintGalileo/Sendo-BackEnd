import { supabase } from '../../config/supabase';
import { isMerchantAvailable } from '../../common/utils/helpers';

export class StoresService {
    async getStores(filters: any, pagination: any) {
        let query = supabase.from('merchants').select('*', { count: 'exact' });

        if (filters.type) {
            query = query.eq('type', filters.type);
        }

        if (filters.rating) {
            query = query.gte('rating', parseFloat(filters.rating));
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

        let stores = (data || []).map(store => ({
            ...store,
            is_available: isMerchantAvailable(store)
        }));

        if (filters.lat && filters.lng) {
            stores = this.sortByDistance(stores, parseFloat(filters.lat), parseFloat(filters.lng));
        }

        return { data: stores, totalCount: count || 0 };
    }

    async getStoreById(storeId: string) {
        const { data, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('id', storeId)
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getStoreMenu(storeId: string) {
        // Menu usually implies categories and their nested products
        const { data, error } = await supabase
            .from('categories')
            .select('*, products(*)')
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
            .select('*', { count: 'exact' })
            .eq('merchant_id', storeId)
            .range(from, to);

        if (error) throw new Error(error.message);
        return { data: data || [], totalCount: count || 0 };
    }

    // Basic Haversine distance formula used for local sorting
    private sortByDistance(stores: any[], userLat: number, userLng: number) {
        // For simplicity, we just sort the current page of results.
        return stores.map(store => {
            if (!store.latitude || !store.longitude) return { ...store, distance: Infinity };
            const dist = this.getDistanceFromLatLonInKm(userLat, userLng, store.latitude, store.longitude);
            return { ...store, distance: dist };
        }).sort((a, b) => a.distance - b.distance);
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
