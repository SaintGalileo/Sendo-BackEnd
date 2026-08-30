import { supabase } from '../../config/supabase';
import { SocketService } from '../notifications/socket.service';

const ORDER_SELECT = `
    *,
    merchant:merchants!orders_merchant_id_fkey(id, name, type, address, latitude, longitude),
    consumer:users!orders_consumer_id_fkey(id, first_name, last_name, phone),
    courier:couriers!orders_courier_id_fkey(id, name, vehicle_type, plate_number, is_online, location:courier_locations(lat, lng, updated_at))
`;

/** Courier has accepted/been assigned but is not yet out for delivery. */
const ACCEPTED_STATUSES = ['ready_for_pickup', 'accepted', 'preparing', 'picked_up'] as const;
/** Courier is actively delivering to the customer. */
const OUT_FOR_DELIVERY_STATUSES = ['on_the_way', 'out_for_delivery'] as const;
const MAP_ACTIVE_STATUSES = [
    'pending',
    'ready_for_pickup',
    'accepted',
    'preparing',
    'picked_up',
    'on_the_way',
    'out_for_delivery',
    'delivered',
] as const;

const PAIR_COLORS = [
    '#D32F2F',
    '#1976D2',
    '#388E3C',
    '#F57C00',
    '#7B1FA2',
    '#00838F',
    '#C2185B',
    '#5D4037',
];

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

function orderStatusOf(row: any): string {
    return String(row?.status || row?.order_status || '').toLowerCase();
}

function mapStatusBucket(status: string, hasCourier: boolean): string {
    if (status === 'delivered') return 'delivered';
    if (OUT_FOR_DELIVERY_STATUSES.includes(status as any)) return 'out_for_delivery';
    if (ACCEPTED_STATUSES.includes(status as any) && hasCourier) return 'accepted';
    if (!hasCourier && (status === 'ready_for_pickup' || status === 'pending' || status === 'accepted')) {
        return 'unassigned';
    }
    if (status === 'pending') return 'pending';
    return hasCourier ? 'accepted' : 'unassigned';
}

function finiteCoord(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export class AdminDispatchService {
    async listAvailableOrders(page = 1, limit = 20) {
        const offset = (page - 1) * limit;

        const { data, error, count } = await supabase
            .from('orders')
            .select(ORDER_SELECT, { count: 'exact' })
            .in('status', ['ready_for_pickup'])
            .is('courier_id', null)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) {
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
            .in('status', statuses)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            return { success: false, message: error.message, data: null };
        }

        return {
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        };
    }

    async getOverviewMap() {
        const [couriersRes, ordersRes] = await Promise.all([
            supabase
                .from('couriers')
                .select(`
                    id, name, vehicle_type, plate_number, is_online,
                    user:users!couriers_user_id_fkey(id, first_name, last_name, phone),
                    location:courier_locations(lat, lng, updated_at)
                `)
                .eq('is_online', true)
                .limit(200),
            supabase
                .from('orders')
                .select(ORDER_SELECT)
                .order('created_at', { ascending: false })
                .limit(200),
        ]);

        if (couriersRes.error) {
            return { success: false, message: couriersRes.error.message, data: null };
        }
        if (ordersRes.error) {
            return { success: false, message: ordersRes.error.message, data: null };
        }

        const colorByCourier = new Map<string, string>();
        let colorIdx = 0;
        const colorForCourier = (courierId: string | null) => {
            if (!courierId) return '#9E9E9E';
            if (!colorByCourier.has(courierId)) {
                colorByCourier.set(courierId, PAIR_COLORS[colorIdx % PAIR_COLORS.length]);
                colorIdx += 1;
            }
            return colorByCourier.get(courierId)!;
        };

        const couriers = (couriersRes.data || [])
            .map((row: any) => {
                const loc = Array.isArray(row.location) ? row.location[0] : row.location;
                const lat = finiteCoord(loc?.lat);
                const lng = finiteCoord(loc?.lng);
                if (lat == null || lng == null) return null;
                const color = colorForCourier(row.id);
                return {
                    id: row.id,
                    name:
                        row.name ||
                        `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim() ||
                        'Courier',
                    lat,
                    lng,
                    vehicle_type: row.vehicle_type,
                    plate_number: row.plate_number,
                    is_online: row.is_online,
                    phone: row.user?.phone || null,
                    color,
                    last_location_at: loc?.updated_at || null,
                };
            })
            .filter(Boolean);

        const orders = (ordersRes.data || [])
            .map((row: any) => {
                const status = orderStatusOf(row);
                if (!MAP_ACTIVE_STATUSES.includes(status as any) && status !== 'cancelled') {
                    // keep delivered + active only
                }
                if (status === 'cancelled') return null;
                if (!MAP_ACTIVE_STATUSES.includes(status as any)) return null;

                const merchantLat = finiteCoord(row.merchant?.latitude);
                const merchantLng = finiteCoord(row.merchant?.longitude);
                const deliveryLat = finiteCoord(row.delivery_lat ?? row.dropoff_lat ?? row.latitude);
                const deliveryLng = finiteCoord(row.delivery_lng ?? row.dropoff_lng ?? row.longitude);
                if (
                    (merchantLat == null || merchantLng == null) &&
                    (deliveryLat == null || deliveryLng == null)
                ) {
                    return null;
                }

                const courierId = row.courier_id || row.courier?.id || null;
                const bucket = mapStatusBucket(status, Boolean(courierId));
                const color = colorForCourier(courierId);

                let courierLat: number | null = null;
                let courierLng: number | null = null;
                if (row.courier) {
                    const cloc = Array.isArray(row.courier.location)
                        ? row.courier.location[0]
                        : row.courier.location;
                    courierLat = finiteCoord(cloc?.lat);
                    courierLng = finiteCoord(cloc?.lng);
                }

                return {
                    id: row.id,
                    status,
                    status_bucket: bucket,
                    color,
                    courier_id: courierId,
                    courier_name: row.courier?.name || null,
                    merchant_id: row.merchant?.id || row.merchant_id || null,
                    merchant_name: row.merchant?.name || null,
                    merchant_lat: merchantLat,
                    merchant_lng: merchantLng,
                    delivery_lat: deliveryLat,
                    delivery_lng: deliveryLng,
                    delivery_address: row.delivery_address || null,
                    courier_lat: courierLat,
                    courier_lng: courierLng,
                    consumer_name:
                        `${row.consumer?.first_name || ''} ${row.consumer?.last_name || ''}`.trim() ||
                        null,
                };
            })
            .filter(Boolean);

        return {
            success: true,
            data: {
                couriers,
                orders,
                generated_at: new Date().toISOString(),
            },
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

        const selectLite = 'id, status, merchant:merchants!orders_merchant_id_fkey(type)';
        let unassignedData: any[] | null = null;
        let acceptedData: any[] | null = null;
        let outData: any[] | null = null;

        const [u, a, o] = await Promise.all([
            supabase.from('orders').select(selectLite).eq('status', 'ready_for_pickup').is('courier_id', null),
            supabase.from('orders').select(selectLite).not('courier_id', 'is', null).in('status', [...ACCEPTED_STATUSES]),
            supabase.from('orders').select(selectLite).not('courier_id', 'is', null).in('status', [...OUT_FOR_DELIVERY_STATUSES]),
        ]);
        if (u.error || a.error || o.error) {
            return {
                success: false,
                message:
                    u.error?.message || a.error?.message || o.error?.message || 'Failed to load dispatch counts',
                data: null,
            };
        }
        unassignedData = u.data || [];
        acceptedData = a.data || [];
        outData = o.data || [];

        for (const row of unassignedData || []) {
            const moduleKey = resolveModuleKey((row as any).merchant?.type);
            const cat = MODULE_TO_CATEGORY[moduleKey] || '1';
            bump(cat, 'unassigned');
        }

        for (const row of acceptedData || []) {
            const moduleKey = resolveModuleKey((row as any).merchant?.type);
            const cat = MODULE_TO_CATEGORY[moduleKey] || '1';
            bump(cat, 'accepted');
            bump(cat, 'ongoing');
        }

        for (const row of outData || []) {
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
            .select('id, status, courier_id')
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
                status: 'picked_up',
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
