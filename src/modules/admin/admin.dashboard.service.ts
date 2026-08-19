import { supabase } from '../../config/supabase';

export class AdminDashboardService {
    async getOverview() {
        const [ordersResult, usersResult, merchantsResult, couriersResult] = await Promise.all([
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('merchants').select('*', { count: 'exact', head: true }),
            supabase.from('couriers').select('*', { count: 'exact', head: true }),
        ]);

        // Revenue: sum of total_amount for delivered orders
        const { data: revenueData } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('order_status', 'delivered');

        const totalRevenue = (revenueData || []).reduce(
            (sum: number, o: any) => sum + (Number(o.total_amount) || 0),
            0
        );

        // Recent orders
        const { data: recentOrders } = await supabase
            .from('orders')
            .select(`
                id, order_number, order_status, total_amount, created_at,
                merchant:merchants!orders_merchant_id_fkey(name),
                consumer:users!orders_consumer_id_fkey(first_name, last_name)
            `)
            .order('created_at', { ascending: false })
            .limit(5);

        // Order status counts
        const statusCounts: Record<string, number> = {};
        const statuses = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_the_way', 'delivered', 'cancelled'];
        for (const s of statuses) {
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('order_status', s);
            statusCounts[s] = count || 0;
        }

        // Top-selling stores (by order count)
        const { data: topStoresRaw } = await supabase
            .from('orders')
            .select('merchant_id, merchant:merchants!orders_merchant_id_fkey(id, name)')
            .not('merchant_id', 'is', null);

        const storeOrderMap: Record<string, { id: string; name: string; orders: number }> = {};
        for (const o of topStoresRaw || []) {
            const m = o.merchant as any;
            if (!m?.id) continue;
            if (!storeOrderMap[m.id]) storeOrderMap[m.id] = { id: m.id, name: m.name, orders: 0 };
            storeOrderMap[m.id].orders++;
        }
        const topSellingStores = Object.values(storeOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        // Popular stores (by favorites count — fallback to top-selling if no favorites table)
        const popularStores = topSellingStores.map(s => ({ ...s, likes: s.orders }));

        // Top-selling items
        const { data: orderItemsRaw } = await supabase
            .from('order_items')
            .select('product_id, product_name, quantity');

        const itemSoldMap: Record<string, { id: string; name: string; sold: number }> = {};
        for (const oi of orderItemsRaw || []) {
            const key = oi.product_id || oi.product_name;
            if (!key) continue;
            if (!itemSoldMap[key]) itemSoldMap[key] = { id: oi.product_id || key, name: oi.product_name, sold: 0 };
            itemSoldMap[key].sold += oi.quantity || 1;
        }
        const topSellingItems = Object.values(itemSoldMap)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 6);

        // Total items count
        const { count: totalItems } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        return {
            success: true,
            data: {
                totalOrders: ordersResult.count || 0,
                totalUsers: usersResult.count || 0,
                totalMerchants: merchantsResult.count || 0,
                totalCouriers: couriersResult.count || 0,
                totalItems: totalItems || 0,
                totalRevenue,
                recentOrders: recentOrders || [],
                orderStatusCounts: statusCounts,
                topSellingStores,
                popularStores,
                topSellingItems,
            },
        };
    }
}
