import { supabase } from '../../config/supabase';

export class AdminAttributesService {
    async listAttributes(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('attributes')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getAttribute(id: string) {
        const { data, error } = await supabase
            .from('attributes')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async createAttribute(attributeData: Record<string, any>) {
        const { data, error } = await supabase
            .from('attributes')
            .insert([attributeData])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Attribute created', data };
    }

    async updateAttribute(id: string, updates: Record<string, any>) {
        const { data, error } = await supabase
            .from('attributes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Attribute updated', data };
    }

    async deleteAttribute(id: string) {
        const { error } = await supabase
            .from('attributes')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Attribute deleted' };
    }
}
