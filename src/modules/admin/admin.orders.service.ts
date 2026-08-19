import { supabase } from '../../config/supabase';

export interface OrderFilters {
    status?: string;
    payment_status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export class AdminOrdersService {
    async listOrders(filters: OrderFilters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('orders')
            .select(`
                *,
                merchant:merchants!orders_merchant_id_fkey(id, name, type, logo_url),
                consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone, email)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (filters.status) {
            query = query.eq('order_status', filters.status);
        }
        if (filters.payment_status) {
            query = query.eq('payment_status', filters.payment_status);
        }
        if (filters.search) {
            query = query.or(`order_number.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching admin orders:', error);
            return { success: false, message: error.message, data: null };
        }

        return {
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        };
    }

    async getOrder(id: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                merchant:merchants!orders_merchant_id_fkey(id, name, type, phone, address, logo_url),
                consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone, email),
                courier:couriers!orders_courier_id_fkey(id, name, vehicle_type, plate_number),
                order_items(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching order:', error);
            return { success: false, message: error.message, data: null };
        }

        return { success: true, data };
    }

    async cancelOrder(id: string) {
        const { data, error } = await supabase
            .from('orders')
            .update({ order_status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error cancelling order:', error);
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Order cancelled', data };
    }
}
