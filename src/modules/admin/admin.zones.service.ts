import { supabase } from '../../config/supabase';
import { zoneKeyFromCityState } from './moduleMerchantTypes';

export class AdminZonesService {
    async listZones(page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;

            const { data, error, count } = await supabase
                .from('zones')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } };

            return {
                success: true,
                data: data || [],
                pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
            };
        } catch {
            return { success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
        }
    }

    /** Distinct merchant city/state pairs for hybrid zone filtering. */
    async listLocationZones() {
        try {
            const { data, error } = await supabase
                .from('merchants')
                .select('city, state')
                .not('city', 'is', null)
                .neq('city', '');

            if (error) {
                return { success: true, data: [{ id: 'all', label: 'All zones', city: null, state: null }] };
            }

            const seen = new Map<string, { id: string; label: string; city: string; state: string | null }>();
            for (const row of data || []) {
                const city = String(row.city || '').trim();
                if (!city) continue;
                const state = String(row.state || '').trim() || null;
                const id = zoneKeyFromCityState(city, state);
                if (seen.has(id)) continue;
                const label = state ? `${city}, ${state}` : city;
                seen.set(id, { id, label, city, state });
            }

            const locations = Array.from(seen.values()).sort((a, b) =>
                a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
            );

            return {
                success: true,
                data: [
                    { id: 'all', label: 'All zones', city: null, state: null },
                    ...locations,
                ],
            };
        } catch {
            return { success: true, data: [{ id: 'all', label: 'All zones', city: null, state: null }] };
        }
    }

    async createZone(zoneData: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('zones')
                .insert([zoneData])
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Zone created', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to create zone' };
        }
    }

    async updateZone(id: string, updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('zones')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Zone updated', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update zone' };
        }
    }

    async deleteZone(id: string) {
        try {
            const { error } = await supabase
                .from('zones')
                .delete()
                .eq('id', id);

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Zone deleted' };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to delete zone' };
        }
    }
}
