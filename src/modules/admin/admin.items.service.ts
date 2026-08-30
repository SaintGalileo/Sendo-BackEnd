import { supabase } from '../../config/supabase';
import { merchantIdsForScope } from './admin.scope';

export interface ItemFilters {
    search?: string;
    store_id?: string;
    module?: string;
    city?: string;
    state?: string;
    zone?: string;
    page?: number;
    limit?: number;
}

export class AdminItemsService {
    async listItems(filters: ItemFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const merchantIds = await merchantIdsForScope({
            module: filters.module,
            city: filters.city,
            state: filters.state,
            zone: filters.zone,
        });

        if (merchantIds && merchantIds.length === 0) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
            };
        }

        let query = supabase
            .from('products')
            .select(`
                *,
                merchant:merchants!products_merchant_id_fkey(id, name, type, logo_url, city, state)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.store_id) {
            query = query.eq('store_id', filters.store_id);
        }
        if (merchantIds) {
            query = query.in('merchant_id', merchantIds);
        }
        if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching admin items:', error);
            return { success: false, message: error.message, data: null };
        }

        return {
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        };
    }

    async getItem(id: string) {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                merchant:merchants!products_merchant_id_fkey(id, name, type, logo_url)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching item:', error);
            return { success: false, message: error.message, data: null };
        }

        return { success: true, data };
    }

    async createItem(itemData: Record<string, any>) {
        const { data, error } = await supabase
            .from('products')
            .insert([itemData])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Item created', data };
    }

    async updateItem(id: string, updates: Record<string, any>) {
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Item updated', data };
    }

    async deleteItem(id: string) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Item deleted' };
    }

    async bulkCreateItems(rows: Record<string, unknown>[]) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, message: 'rows array is required', data: null };
        }
        const errors: Array<{ row: number; message: string }> = [];
        let succeeded = 0;
        for (let i = 0; i < rows.length; i++) {
            const result = await this.createItem(rows[i]);
            if (result.success) succeeded += 1;
            else errors.push({ row: i + 1, message: result.message || 'Failed to create item' });
        }
        return {
            success: true,
            message: `Imported ${succeeded} of ${rows.length} items`,
            data: { total: rows.length, succeeded, failed: rows.length - succeeded, errors },
        };
    }
}
