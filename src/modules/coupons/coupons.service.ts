import { supabase } from '../../config/supabase';

export class CouponsService {
    async getAvailableCoupons() {
        // Fetch active generic platform coupons
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .gte('valid_until', new Date().toISOString());

        if (error) throw new Error(error.message);
        return data;
    }

    async applyCoupon(userId: string, code: string) {
        // Find the coupon
        const { data: coupon, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code.toUpperCase())
            .eq('is_active', true)
            .gte('valid_until', new Date().toISOString())
            .single();

        if (error || !coupon) throw new Error('Invalid or expired coupon');

        // Check user usage limit
        const { count, error: usageError } = await supabase
            .from('coupon_usages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('coupon_id', coupon.id);

        if (usageError) throw new Error(usageError.message);

        if (coupon.usage_limit_per_user && (count || 0) >= coupon.usage_limit_per_user) {
            throw new Error('You have reached the usage limit for this coupon');
        }

        // Return discount value logic to caller (e.g. cart or checkout)
        return coupon;
    }
}
