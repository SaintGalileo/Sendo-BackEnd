import { supabase } from '../../config/supabase';

const STATUSES = [
    'pending',
    'accepted',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
] as const;

export class AdminDashboardService {
    async getOverview() {
        // Run every independent query in parallel — sequential status loops were the main latency sink.
        const [
            ordersResult,
            usersResult,
            merchantsResult,
            couriersResult,
            itemsResult,
            revenueResult,
            recentOrdersResult,
            statusResults,
            refundedPayResult,
            failedPayResult,
            topStoresRawResult,
            orderItemsRawResult,
            salesSeriesResult,
        ] = await Promise.all([
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('merchants').select('*', { count: 'exact', head: true }),
            supabase.from('couriers').select('*', { count: 'exact', head: true }),
            supabase.from('products').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('total_amount, total_price').eq('status', 'delivered'),
            supabase
                .from('orders')
                .select(`
                    id, order_number, status, total_amount, total_price, created_at,
                    merchant:merchants!orders_merchant_id_fkey(name),
                    consumer:users!orders_consumer_id_fkey(first_name, last_name)
                `)
                .order('created_at', { ascending: false })
                .limit(5),
            Promise.all(
                STATUSES.map((s) =>
                    supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', s),
                ),
            ),
            supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('payment_status', 'refunded'),
            supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('payment_status', 'failed'),
            // Cap scan size — full table scans were very slow over the tunnel.
            supabase
                .from('orders')
                .select('merchant_id, merchant:merchants!orders_merchant_id_fkey(id, name)')
                .not('merchant_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(400),
            supabase
                .from('order_items')
                .select('product_id, product_name, quantity')
                .limit(800),
            supabase
                .from('orders')
                .select('total_amount, created_at')
                .eq('status', 'delivered')
                .order('created_at', { ascending: false })
                .limit(365),
        ]);

        const totalRevenue = (revenueResult.data || []).reduce(
            (sum: number, o: { total_amount?: number | string; total_price?: number | string }) =>
                sum + (Number(o.total_amount ?? o.total_price) || 0),
            0,
        );

        const orderStatusCounts: Record<string, number> = {};
        STATUSES.forEach((s, i) => {
            orderStatusCounts[s] = statusResults[i]?.count || 0;
        });
        orderStatusCounts.refunded = refundedPayResult.count || 0;
        orderStatusCounts.failed = failedPayResult.count || 0;

        const storeOrderMap: Record<string, { id: string; name: string; orders: number }> = {};
        for (const o of topStoresRawResult.data || []) {
            const m = o.merchant as { id?: string; name?: string } | null;
            if (!m?.id) continue;
            if (!storeOrderMap[m.id]) storeOrderMap[m.id] = { id: m.id, name: m.name || 'Store', orders: 0 };
            storeOrderMap[m.id].orders++;
        }
        const topSellingStores = Object.values(storeOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);
        const popularStores = topSellingStores.map((s) => ({ id: s.id, name: s.name, likes: s.orders }));

        const itemSoldMap: Record<string, { id: string; name: string; sold: number }> = {};
        for (const oi of orderItemsRawResult.data || []) {
            const key = oi.product_id || oi.product_name;
            if (!key) continue;
            if (!itemSoldMap[key]) {
                itemSoldMap[key] = {
                    id: oi.product_id || String(key),
                    name: oi.product_name || 'Item',
                    sold: 0,
                };
            }
            itemSoldMap[key].sold += oi.quantity || 1;
        }
        const topSellingItems = Object.values(itemSoldMap)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 6);

        // Build day-wise gross series for the chart in the same round-trip.
        const dayMap: Record<string, number> = {};
        for (const row of salesSeriesResult.data || []) {
            const day = row.created_at?.slice(0, 10);
            if (!day) continue;
            dayMap[day] = (dayMap[day] || 0) + (Number(row.total_amount ?? row.total_price) || 0);
        }
        const salesSeries = Object.entries(dayMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, gross]) => ({
                date,
                label: date.slice(5),
                gross,
            }));

        return {
            success: true,
            data: {
                totalOrders: ordersResult.count || 0,
                totalUsers: usersResult.count || 0,
                totalMerchants: merchantsResult.count || 0,
                totalCouriers: couriersResult.count || 0,
                totalItems: itemsResult.count || 0,
                totalRevenue,
                recentOrders: (recentOrdersResult.data || []).map((row: Record<string, unknown>) => ({
                    ...row,
                    order_status: row.order_status || row.status,
                    total_amount: row.total_amount ?? row.total_price,
                })),
                orderStatusCounts,
                topSellingStores,
                popularStores,
                topSellingItems,
                mostRatedItems: topSellingItems.map((i) => ({
                    id: i.id,
                    name: i.name,
                    likes: i.sold,
                })),
                salesSeries,
            },
        };
    }
}
