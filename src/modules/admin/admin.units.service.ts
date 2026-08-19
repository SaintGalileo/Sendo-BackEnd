import { supabase } from '../../config/supabase';

export class AdminUnitsService {
    async listUnits(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('units')
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

    async createUnit(unitData: Record<string, any>) {
        const { data, error } = await supabase
            .from('units')
            .insert([unitData])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Unit created', data };
    }

    async updateUnit(id: string, updates: Record<string, any>) {
        const { data, error } = await supabase
            .from('units')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Unit updated', data };
    }

    async deleteUnit(id: string) {
        const { error } = await supabase
            .from('units')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Unit deleted' };
    }
}
