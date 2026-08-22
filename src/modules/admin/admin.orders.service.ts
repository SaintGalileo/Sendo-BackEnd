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
            const grouped: Record<string, string[]> = {
                preparing: ['preparing', 'ready_for_pickup'],
                processing: ['preparing', 'ready_for_pickup'],
                on_the_way: ['on_the_way', 'picked_up'],
                cancelled: ['cancelled', 'canceled'],
                canceled: ['cancelled', 'canceled'],
            };
            const values = grouped[filters.status] || [filters.status];
            query = values.length === 1 ? query.eq('status', values[0]) : query.in('status', values);
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

        const rows = (data || []).map((row: Record<string, unknown>) => ({
            ...row,
            order_status: row.order_status || row.status,
            total_amount: row.total_amount ?? row.total_price,
        }));

        return {
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        };
    }

    async getCounts() {
        const { data, error, count } = await supabase
            .from('orders')
            .select('status, payment_status, payment_method', { count: 'exact' })
            .range(0, 9999);

        if (error) {
            return { success: false, message: error.message, data: null };
        }

        const byStatus: Record<string, number> = {};
        const bump = (key: string) => {
            byStatus[key] = (byStatus[key] || 0) + 1;
        };

        for (const row of data || []) {
            const raw = String(row.status || 'pending').toLowerCase();
            bump(raw);
            const pay = String(row.payment_status || '').toLowerCase();
            const method = String(row.payment_method || '').toLowerCase();
            if (pay === 'failed') bump('failed');
            if (pay === 'offline' || pay === 'cash' || method === 'cash') bump('offline');
            if (pay === 'refund_requested') bump('refund_requested');
            if (pay === 'refunded') bump('refunded');
        }

        return {
            success: true,
            data: {
                total: count || (data || []).length,
                byStatus,
            },
        };
    }

    async getOrder(id: string) {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                merchant:merchants!orders_merchant_id_fkey(id, name, type, phone, address, logo_url, latitude, longitude),
                consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone, email),
                courier:couriers!orders_courier_id_fkey(id, name, vehicle_type, plate_number, location:courier_locations(lat, lng, updated_at)),
                order_items(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            // Fallback without location join if relation is missing
            const fallback = await supabase
                .from('orders')
                .select(`
                    *,
                    merchant:merchants!orders_merchant_id_fkey(id, name, type, phone, address, logo_url, latitude, longitude),
                    consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone, email),
                    courier:couriers!orders_courier_id_fkey(id, name, vehicle_type, plate_number),
                    order_items(*)
                `)
                .eq('id', id)
                .single();

            if (fallback.error) {
                console.error('Error fetching order:', fallback.error);
                return { success: false, message: fallback.error.message, data: null };
            }
            return { success: true, data: fallback.data };
        }

        return { success: true, data };
    }

    async cancelOrder(id: string) {
        const { data, error } = await supabase
            .from('orders')
            .update({ status: 'cancelled' })
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
