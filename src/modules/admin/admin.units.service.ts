import { supabase } from '../../config/supabase';

function normalizeStatus(raw: unknown): 'Active' | 'Inactive' {
    const s = String(raw ?? 'Active').toLowerCase();
    return s === 'inactive' || s === 'false' || s === '0' ? 'Inactive' : 'Active';
}

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

    async getUnit(id: string) {
        const { data, error } = await supabase
            .from('units')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return { success: false, message: error.message, data: null };
        return { success: true, data };
    }

    async createUnit(unitData: Record<string, any>) {
        const name = String(unitData?.name || '').trim();
        if (!name) return { success: false, message: 'Name is required' };

        const payload = {
            name,
            status: normalizeStatus(unitData?.status),
        };

        const { data, error } = await supabase
            .from('units')
            .insert([payload])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Unit created', data };
    }

    async updateUnit(id: string, updates: Record<string, any>) {
        const patch: Record<string, unknown> = {};
        if (updates.name !== undefined) {
            const name = String(updates.name || '').trim();
            if (!name) return { success: false, message: 'Name is required' };
            patch.name = name;
        }
        if (updates.status !== undefined) {
            patch.status = normalizeStatus(updates.status);
        }
        if (Object.keys(patch).length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        const { data, error } = await supabase
            .from('units')
            .update(patch)
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
