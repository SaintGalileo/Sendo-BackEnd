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
                id, merchant_id, category_id, name, description, price,
                image_url, images, is_available, stock_quantity, track_stock,
                created_at, updated_at,
                merchant:merchants!products_merchant_id_fkey(id, name, type, logo_url, city, state),
                category:categories!products_category_id_fkey(id, name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.store_id) {
            query = query.eq('merchant_id', filters.store_id);
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
                id, merchant_id, category_id, name, description, price,
                image_url, images, is_available, stock_quantity, track_stock,
                created_at, updated_at,
                merchant:merchants!products_merchant_id_fkey(id, name, type, logo_url, city, state),
                category:categories!products_category_id_fkey(id, name)
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
        const name = String(itemData?.name || '').trim();
        if (!name) return { success: false, message: 'Name is required' };

        const merchantId = itemData.merchant_id || itemData.store_id;
        if (!merchantId) return { success: false, message: 'Store is required' };

        const images = Array.isArray(itemData.images)
            ? itemData.images.map(String).filter(Boolean)
            : [];
        const imageUrl =
            itemData.image_url || (images.length > 0 ? images[0] : null);

        const payload: Record<string, unknown> = {
            name,
            merchant_id: merchantId,
            category_id: itemData.category_id || null,
            price: Number(itemData.price) || 0,
            description: itemData.description ? String(itemData.description).trim() : null,
            is_available: itemData.is_available !== false,
            stock_quantity: Number(itemData.stock_quantity ?? 0) || 0,
            track_stock: itemData.track_stock !== false,
            images,
            image_url: imageUrl,
        };

        const { data, error } = await supabase
            .from('products')
            .insert([payload])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Item created', data };
    }

    async updateItem(id: string, updates: Record<string, any>) {
        const patch: Record<string, unknown> = {};
        if (updates.name !== undefined) {
            const name = String(updates.name || '').trim();
            if (!name) return { success: false, message: 'Name is required' };
            patch.name = name;
        }
        if (updates.merchant_id !== undefined || updates.store_id !== undefined) {
            patch.merchant_id = updates.merchant_id || updates.store_id;
        }
        if (updates.category_id !== undefined) patch.category_id = updates.category_id || null;
        if (updates.price !== undefined) patch.price = Number(updates.price) || 0;
        if (updates.description !== undefined) {
            patch.description = updates.description ? String(updates.description).trim() : null;
        }
        if (updates.is_available !== undefined) patch.is_available = Boolean(updates.is_available);
        if (updates.stock_quantity !== undefined) {
            patch.stock_quantity = Number(updates.stock_quantity) || 0;
        }
        if (updates.track_stock !== undefined) patch.track_stock = Boolean(updates.track_stock);
        if (updates.images !== undefined) {
            const images = Array.isArray(updates.images)
                ? updates.images.map(String).filter(Boolean)
                : [];
            patch.images = images;
            if (updates.image_url === undefined) {
                patch.image_url = images[0] || null;
            }
        }
        if (updates.image_url !== undefined) patch.image_url = updates.image_url || null;

        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        const { data, error } = await supabase
            .from('products')
            .update(patch)
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
