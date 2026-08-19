import { supabase } from '../../config/supabase';

export class AdminMessagesService {
    async list(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        try {
            const { data, error, count } = await supabase
                .from('messages')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
            return { success: true, data, pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
        } catch {
            return { success: true, data: [] };
        }
    }

    async getById(id: string) {
        try {
            const { data, error } = await supabase.from('messages').select('*').eq('id', id).single();
            if (error) return { success: true, data: null };
            return { success: true, data };
        } catch {
            return { success: true, data: null };
        }
    }
}
