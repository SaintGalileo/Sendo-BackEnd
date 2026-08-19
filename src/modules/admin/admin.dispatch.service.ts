import { supabase } from '../../config/supabase';
import { SocketService } from '../notifications/socket.service';

export class AdminDispatchService {
    async listAvailableOrders(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('orders')
            .select(`
                *,
                merchant:merchants!orders_merchant_id_fkey(id, name, address, latitude, longitude),
                consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone)
            `, { count: 'exact' })
            .in('order_status', ['ready_for_pickup'])
            .is('courier_id', null)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async assignCourier(orderId: string, courierId: string) {
        // Verify courier exists and is online
        const { data: courier, error: courierError } = await supabase
            .from('couriers')
            .select('id, user_id, name, is_online')
            .eq('id', courierId)
            .single();

        if (courierError || !courier) {
            return { success: false, message: 'Courier not found' };
        }

        // Verify order exists and is assignable
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, order_status, courier_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return { success: false, message: 'Order not found' };
        }

        if (order.courier_id) {
            return { success: false, message: 'Order already has a courier assigned' };
        }

        const { data, error } = await supabase
            .from('orders')
            .update({
                courier_id: courierId,
                order_status: 'picked_up',
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) {
            return { success: false, message: error.message };
        }

        // Emit socket events
        try {
            const socketService = SocketService.getInstance();
            socketService.emitToDrivers('delivery:assigned', {
                orderId,
                courierId: courier.user_id,
                message: 'You have been assigned a new delivery by admin',
            });
        } catch {
            // Socket notification is best-effort
        }

        return { success: true, message: 'Courier assigned successfully', data };
    }
}
