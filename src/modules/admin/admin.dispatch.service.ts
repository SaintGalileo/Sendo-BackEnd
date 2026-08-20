import { supabase } from '../../config/supabase';
import { SocketService } from '../notifications/socket.service';

const ORDER_SELECT = `
    *,
    merchant:merchants!orders_merchant_id_fkey(id, name, type, address, latitude, longitude),
    consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone),
    courier:couriers!orders_courier_id_fkey(id, name, vehicle_type, plate_number)
`;

/** Courier has accepted/been assigned but is not yet out for delivery. */
const ACCEPTED_STATUSES = ['ready_for_pickup', 'accepted', 'preparing', 'picked_up'] as const;
/** Courier is actively delivering to the customer. */
const OUT_FOR_DELIVERY_STATUSES = ['on_the_way', 'out_for_delivery'] as const;

type MerchantType = string | null | undefined;

function resolveModuleKey(merchantType: MerchantType): string {
    const type = String(merchantType || '').toLowerCase();
    if (type.includes('pharmacy')) return 'pharmacy';
    if (type.includes('food') || type.includes('restaurant')) return 'food';
    if (type.includes('parcel')) return 'parcel';
    if (type.includes('shop') || type === 'store') return 'shop';
    return 'grocery';
}

const MODULE_TO_CATEGORY: Record<string, string> = {
    grocery: '1',
    pharmacy: '2',
    shop: '3',
    food: '4',
    parcel: '5',
};

function emptyCategoryCounts() {
    return {
        unassigned: 0,
        accepted: 0,
        outForDelivery: 0,
        ongoing: 0,
    };
}

export class AdminDispatchService {
    async listAvailableOrders(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('orders')
            .select(ORDER_SELECT, { count: 'exact' })
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

    /**
     * Ongoing = courier assigned and still in progress
     * (accepted / out for delivery style statuses).
     */
    async listOngoingOrders(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const statuses = [...ACCEPTED_STATUSES, ...OUT_FOR_DELIVERY_STATUSES];

        const { data, error, count } = await supabase
            .from('orders')
            .select(ORDER_SELECT, { count: 'exact' })
            .not('courier_id', 'is', null)
            .in('order_status', statuses)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) return { success: false, message: error.message, data: null };

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getCounts() {
        const byCategory: Record<string, ReturnType<typeof emptyCategoryCounts>> = {
            '1': emptyCategoryCounts(),
            '2': emptyCategoryCounts(),
            '3': emptyCategoryCounts(),
            '4': emptyCategoryCounts(),
            '5': emptyCategoryCounts(),
        };

        const bump = (
            categoryId: string,
            field: keyof ReturnType<typeof emptyCategoryCounts>,
            amount = 1,
        ) => {
            if (!byCategory[categoryId]) byCategory[categoryId] = emptyCategoryCounts();
            byCategory[categoryId][field] += amount;
        };

        const [unassignedRes, acceptedRes, outRes] = await Promise.all([
            supabase
                .from('orders')
                .select('id, merchant:merchants!orders_merchant_id_fkey(type)')
                .eq('order_status', 'ready_for_pickup')
                .is('courier_id', null),
            supabase
                .from('orders')
                .select('id, merchant:merchants!orders_merchant_id_fkey(type)')
                .not('courier_id', 'is', null)
                .in('order_status', [...ACCEPTED_STATUSES]),
            supabase
                .from('orders')
                .select('id, merchant:merchants!orders_merchant_id_fkey(type)')
                .not('courier_id', 'is', null)
                .in('order_status', [...OUT_FOR_DELIVERY_STATUSES]),
        ]);

        if (unassignedRes.error || acceptedRes.error || outRes.error) {
            return {
                success: false,
                message:
                    unassignedRes.error?.message ||
                    acceptedRes.error?.message ||
                    outRes.error?.message ||
                    'Failed to load dispatch counts',
                data: null,
            };
        }

        for (const row of unassignedRes.data || []) {
            const moduleKey = resolveModuleKey((row as any).merchant?.type);
            const cat = MODULE_TO_CATEGORY[moduleKey] || '1';
            bump(cat, 'unassigned');
        }

        for (const row of acceptedRes.data || []) {
            const moduleKey = resolveModuleKey((row as any).merchant?.type);
            const cat = MODULE_TO_CATEGORY[moduleKey] || '1';
            bump(cat, 'accepted');
            bump(cat, 'ongoing');
        }

        for (const row of outRes.data || []) {
            const moduleKey = resolveModuleKey((row as any).merchant?.type);
            const cat = MODULE_TO_CATEGORY[moduleKey] || '1';
            bump(cat, 'outForDelivery');
            bump(cat, 'ongoing');
        }

        const totals = emptyCategoryCounts();
        for (const counts of Object.values(byCategory)) {
            totals.unassigned += counts.unassigned;
            totals.accepted += counts.accepted;
            totals.outForDelivery += counts.outForDelivery;
            totals.ongoing += counts.ongoing;
        }

        return {
            success: true,
            data: { byCategory, totals },
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
