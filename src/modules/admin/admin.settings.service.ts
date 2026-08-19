import { supabase } from '../../config/supabase';

const DEFAULT_BUSINESS_SETTINGS = {
    business_name: '',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    order_auto_accept: false,
    maintenance_mode: false,
};

export class AdminSettingsService {
    async getBusinessSettings() {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .limit(1)
                .single();

            if (error) return { success: true, data: DEFAULT_BUSINESS_SETTINGS };
            return { success: true, data };
        } catch {
            return { success: true, data: DEFAULT_BUSINESS_SETTINGS };
        }
    }

    async updateBusinessSettings(updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .upsert([{ id: 'default', ...updates }])
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Business settings updated', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update settings' };
        }
    }

    async getTaxSettings() {
        try {
            const { data, error } = await supabase
                .from('taxes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return { success: true, data: [] };
            return { success: true, data: data || [] };
        } catch {
            return { success: true, data: [] };
        }
    }

    async updateTaxSettings(id: string, updates: Record<string, any>) {
        try {
            const { data, error } = await supabase
                .from('taxes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) return { success: false, message: error.message };
            return { success: true, message: 'Tax setting updated', data };
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to update tax' };
        }
    }

    async getPaymentMethods() {
        try {
            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return { success: true, data: [] };
            return { success: true, data: data || [] };
        } catch {
            return { success: true, data: [] };
        }
    }
}
