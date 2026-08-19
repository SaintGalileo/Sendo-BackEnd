import { supabase } from '../../config/supabase';

const DEFAULT_DELIVERY_CONFIG = {
    base_fee: 0,
    per_km_charge: 0,
    free_delivery_threshold: 0,
    max_delivery_radius_km: 50,
    auto_assign_courier: false,
};

export class AdminDeliveryService {
    async getDeliveryConfig() {
        try {
            const { data, error } = await supabase
                .from('delivery_config')
                .select('*')
                .limit(1)
                .single();

            if (error) return { success: true, data: DEFAULT_DELIVERY_CONFIG };
            return { success: true, data };
        } catch {
            return { success: true, data: DEFAULT_DELIVERY_CONFIG };
        }
    }

    async updateDeliveryConfig(updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('delivery_config')
                .upsert([{ id: 'default', ...updates }])
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Delivery config updated', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update delivery config' };
        }
    }

    async getVehicleCategories() {
        try {
            const { data, error } = await supabase
                .from('vehicle_categories')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return { success: true, data: [] };
            return { success: true, data: data || [] };
        } catch {
            return { success: true, data: [] };
        }
    }

    async updateVehicleCategory(id: string, updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('vehicle_categories')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Vehicle category updated', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update vehicle category' };
        }
    }
}
