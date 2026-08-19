import { supabase } from '../../config/supabase';

interface PaginationFilters {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    search?: string;
}

function buildPagination(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { from, to, page, limit };
}

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
                adminCommission: totalRevenue * 0.1,
            },
        };
    }

    async getWithdrawRequests(type: 'store' | 'courier', page = 1, limit = 20) {
        return {
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
            message: 'Withdraw requests module pending backend implementation',
        };
    }

    async getAccountTransactions(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            // Table may not exist yet — return empty gracefully
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                message: 'Transactions table not available yet',
            };
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getStoreWithdrawals(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('withdrawals')
            .select('*', { count: 'exact' })
            .eq('type', 'store')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                message: 'Withdrawals table not available yet',
            };
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getCourierWithdrawals(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('withdrawals')
            .select('*', { count: 'exact' })
            .eq('type', 'courier')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                message: 'Withdrawals table not available yet',
            };
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getStoreDisbursements(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('disbursements')
            .select('*', { count: 'exact' })
            .eq('type', 'store')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                message: 'Disbursements table not available yet',
            };
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getCourierDisbursements(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('disbursements')
            .select('*', { count: 'exact' })
            .eq('type', 'courier')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return {
                success: true,
                data: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                message: 'Disbursements table not available yet',
            };
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getCourierEarnings() {
        const { data, error } = await supabase
            .from('orders')
            .select('courier_id, delivery_fee, order_status, created_at')
            .eq('order_status', 'delivered');

        if (error) return { success: false, message: error.message, data: null };

        const earningsMap: Record<string, { courier_id: string; total_earnings: number; total_deliveries: number }> = {};
        for (const order of data || []) {
            if (!order.courier_id) continue;
            if (!earningsMap[order.courier_id]) {
                earningsMap[order.courier_id] = { courier_id: order.courier_id, total_earnings: 0, total_deliveries: 0 };
            }
            earningsMap[order.courier_id].total_earnings += Number(order.delivery_fee) || 0;
            earningsMap[order.courier_id].total_deliveries += 1;
        }

        return { success: true, data: Object.values(earningsMap) };
    }

    async getDayWiseReport(dateFrom?: string, dateTo?: string) {
        let query = supabase
            .from('orders')
            .select('total_amount, delivery_fee, order_status, created_at')
            .eq('order_status', 'delivered');

        if (dateFrom) query = query.gte('created_at', dateFrom);
        if (dateTo) query = query.lte('created_at', dateTo);

        const { data, error } = await query;
        if (error) return { success: false, message: error.message, data: null };

        const dayMap: Record<string, { date: string; orders: number; revenue: number; delivery_fees: number }> = {};
        for (const order of data || []) {
            const day = order.created_at?.slice(0, 10) || 'unknown';
            if (!dayMap[day]) dayMap[day] = { date: day, orders: 0, revenue: 0, delivery_fees: 0 };
            dayMap[day].orders += 1;
            dayMap[day].revenue += Number(order.total_amount) || 0;
            dayMap[day].delivery_fees += Number(order.delivery_fee) || 0;
        }

        return { success: true, data: Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)) };
    }

    async getItemWiseReport() {
        const { data, error } = await supabase
            .from('order_items')
            .select('item_id, item_name, quantity, price, total');

        if (error) return { success: false, message: error.message, data: null };

        const itemMap: Record<string, { item_id: string; item_name: string; total_quantity: number; total_sales: number }> = {};
        for (const item of data || []) {
            const key = item.item_id || item.item_name || 'unknown';
            if (!itemMap[key]) {
                itemMap[key] = { item_id: item.item_id, item_name: item.item_name, total_quantity: 0, total_sales: 0 };
            }
            itemMap[key].total_quantity += Number(item.quantity) || 0;
            itemMap[key].total_sales += Number(item.total || item.price) || 0;
        }

        return { success: true, data: Object.values(itemMap) };
    }

    async getStoreWiseReport() {
        const { data, error } = await supabase
            .from('orders')
            .select('store_id, store_name, total_amount, delivery_fee, order_status')
            .eq('order_status', 'delivered');

        if (error) return { success: false, message: error.message, data: null };

        const storeMap: Record<string, { store_id: string; store_name: string; total_orders: number; total_revenue: number }> = {};
        for (const order of data || []) {
            const key = order.store_id || 'unknown';
            if (!storeMap[key]) {
                storeMap[key] = { store_id: order.store_id, store_name: order.store_name, total_orders: 0, total_revenue: 0 };
            }
            storeMap[key].total_orders += 1;
            storeMap[key].total_revenue += Number(order.total_amount) || 0;
        }

        return { success: true, data: Object.values(storeMap) };
    }

    async getDisbursementReport() {
        const { data, error } = await supabase
            .from('disbursements')
            .select('*');

        if (error) {
            return { success: true, data: [], message: 'Disbursements table not available yet' };
        }

        return { success: true, data: data || [] };
    }
}
