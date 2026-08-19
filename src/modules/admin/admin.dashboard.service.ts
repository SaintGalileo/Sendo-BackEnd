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

        return {
            success: true,
            data: {
                totalOrders: ordersResult.count || 0,
                totalUsers: usersResult.count || 0,
                totalMerchants: merchantsResult.count || 0,
                totalCouriers: couriersResult.count || 0,
                totalRevenue,
                recentOrders: recentOrders || [],
                orderStatusCounts: statusCounts,
            },
        };
    }
}
