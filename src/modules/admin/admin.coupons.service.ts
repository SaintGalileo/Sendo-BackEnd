import { supabase } from '../../config/supabase';

export class AdminCouponsService {
    async listCoupons(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('coupons')
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

    async createCoupon(couponData: Record<string, any>) {
        const { data, error } = await supabase
            .from('coupons')
            .insert([couponData])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Coupon created', data };
    }

    async updateCoupon(id: string, updates: Record<string, any>) {
        const { data, error } = await supabase
            .from('coupons')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Coupon updated', data };
    }

    async deleteCoupon(id: string) {
        const { error } = await supabase
            .from('coupons')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Coupon deleted' };
    }
}
