import { supabase } from '../../config/supabase';

export class AdminTransactionsService {
    async getTransactionReport(dateFrom?: string, dateTo?: string) {
        let query = supabase
            .from('orders')
            .select('total_amount, delivery_fee, order_status, payment_status, payment_method, created_at')
            .eq('order_status', 'delivered');

        if (dateFrom) query = query.gte('created_at', dateFrom);
        if (dateTo) query = query.lte('created_at', dateTo);

        const { data, error } = await query;
        if (error) return { success: false, message: error.message, data: null };

        const totalRevenue = (data || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
        const totalDeliveryFees = (data || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);

        return {
            success: true,
            data: {
                totalRevenue,
                totalDeliveryFees,
                totalOrders: data?.length || 0,
                adminCommission: totalRevenue * 0.1, // placeholder 10% commission
            },
        };
    }

    async getWithdrawRequests(type: 'store' | 'courier', page = 1, limit = 20) {
        // Placeholder: withdraw_requests table not yet created
        return {
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
            message: 'Withdraw requests module pending backend implementation',
        };
    }
}
