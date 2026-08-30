import { supabase } from '../../config/supabase';

export class AdminParcelService {
    async getDashboard() {
        try {
            const [
                ordersResult,
                usersResult,
                couriersResult,
                salesResult,
            ] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, status, total_amount, created_at, courier_id, consumer_id')
                    .or('type.eq.parcel,module.eq.parcel')
                    .limit(2000),
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('couriers').select('*', { count: 'exact', head: true }),
                supabase
                    .from('orders')
                    .select('total_amount, created_at, status')
                    .or('type.eq.parcel,module.eq.parcel')
                    .eq('status', 'delivered')
                    .order('created_at', { ascending: false })
                    .limit(365),
            ]);

            // Fallback: if typed filter fails/empty, use empty set rather than all orders.
            const all = (!ordersResult.error && ordersResult.data) ? ordersResult.data : [];

            const statusOf = (o: { order_status?: string; status?: string }) =>
                o.status || o.order_status || '';

            const unassigned = all.filter((o) =>
                !o.courier_id &&
                ['pending', 'ready_for_pickup', 'accepted'].includes(statusOf(o)),
            ).length;
            const outForDelivery = all.filter((o) =>
                ['on_the_way', 'picked_up'].includes(statusOf(o)),
            ).length;
            const delivered = all.filter((o) => statusOf(o) === 'delivered').length;
            const returned = all.filter((o) =>
                ['cancelled'].includes(statusOf(o)),
            ).length;

            const grossSale = all
                .filter((o) => statusOf(o) === 'delivered')
                .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            const dayMap: Record<string, number> = {};
            for (const row of salesResult.data || []) {
                const day = row.created_at?.slice(0, 10);
                if (!day) continue;
                dayMap[day] = (dayMap[day] || 0) + (Number(row.total_amount) || 0);
            }
            const salesSeries = Object.entries(dayMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, gross]) => ({ date, label: date.slice(5), gross }));

            // Lightweight top lists from available fields (names may be unknown without joins).
            const courierCounts: Record<string, number> = {};
            const customerCounts: Record<string, number> = {};
            for (const o of all) {
                if (o.courier_id) courierCounts[o.courier_id] = (courierCounts[o.courier_id] || 0) + 1;
                if (o.consumer_id) customerCounts[o.consumer_id] = (customerCounts[o.consumer_id] || 0) + 1;
            }
            const topDeliverymen = Object.entries(courierCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, orders]) => ({ id, name: `Courier ${String(id).slice(0, 6)}`, orders }));
            const topCustomers = Object.entries(customerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, orders]) => ({ id, name: `Customer ${String(id).slice(0, 6)}`, orders }));

            const customers = usersResult.count || 0;
            const couriers = couriersResult.count || 0;

            return {
                success: true,
                data: {
                    total_orders: all.length,
                    order_status: {
                        unassigned,
                        out_for_delivery: outForDelivery,
                        delivered,
                        returned,
                    },
                    gross_sale: grossSale,
                    total_users: customers + couriers,
                    customers,
                    couriers,
                    top_deliverymen: topDeliverymen,
                    top_customers: topCustomers,
                    salesSeries,
                },
            };
        } catch {
            return {
                success: true,
                data: {
                    total_orders: 0,
                    order_status: { unassigned: 0, out_for_delivery: 0, delivered: 0, returned: 0 },
                    gross_sale: 0,
                    total_users: 0,
                    customers: 0,
                    couriers: 0,
                    top_deliverymen: [],
                    top_customers: [],
                    salesSeries: [],
                },
            };
        }
    }
}
