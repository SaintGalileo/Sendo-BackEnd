import { supabase } from '../../config/supabase';

export class AdminFlashSalesService {
    async list(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        try {
            const { data, error, count } = await supabase
                .from('flash_sales')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
            return { success: true, data, pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
        } catch {
            return { success: true, data: [] };
        }
    }

    async create(body: Record<string, any>) {
        try {
            const { data, error } = await supabase.from('flash_sales').insert([body]).select().single();
            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Flash sale created', data };
        } catch {
            return { success: true, data: [] };
        }
    }

    async update(id: string, updates: Record<string, any>) {
        try {
            const { data, error } = await supabase.from('flash_sales').update(updates).eq('id', id).select().single();
            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Flash sale updated', data };
        } catch {
            return { success: true, data: [] };
        }
    }

    async delete(id: string) {
        try {
            const { error } = await supabase.from('flash_sales').delete().eq('id', id);
            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Flash sale deleted' };
        } catch {
            return { success: true, data: [] };
        }
    }
}
