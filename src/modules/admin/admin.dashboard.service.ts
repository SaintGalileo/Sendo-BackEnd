import { supabase } from '../../config/supabase';
import { merchantIdsForScope, type ScopeFilters } from './admin.scope';

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

export type DashboardRange = 'this_year' | 'this_month' | 'this_week';

/** Inclusive start of the selected period (ISO), or undefined for all-time. */
export function dashboardRangeFrom(range?: string | null): string | undefined {
    const now = new Date();
    const start = new Date(now);
    if (range === 'this_week') start.setDate(now.getDate() - 6);
    else if (range === 'this_month') start.setDate(1);
    else if (range === 'this_year' || !range) start.setMonth(0, 1);
    else return undefined;
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
}

function applyCreatedAtFrom(query: any, from?: string): any {
    return from ? query.gte('created_at', from) : query;
}

function applyMerchantIds(query: any, merchantIds: string[] | null): any {
    return merchantIds ? query.in('merchant_id', merchantIds) : query;
}

export class AdminDashboardService {
    async getOverview(range?: string | null, scope: ScopeFilters = {}) {
        const from = dashboardRangeFrom(range);
        const merchantIds = await merchantIdsForScope(scope);
        const emptyScope = merchantIds && merchantIds.length === 0;

        if (emptyScope) {
            return {
                success: true,
                data: {
                    totalOrders: 0,
                    totalUsers: 0,
                    totalMerchants: 0,
                    totalCouriers: 0,
                    totalItems: 0,
                    totalRevenue: 0,
                    recentOrders: [],
                    orderStatusCounts: Object.fromEntries(STATUSES.map((s) => [s, 0])),
                    topSellingStores: [],
                    popularStores: [],
                    topSellingItems: [],
                    mostRatedItems: [],
                    salesSeries: [],
                    range: range || 'this_year',
                },
            };
        }

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
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase.from('orders').select('*', { count: 'exact', head: true }),
                    from,
                ),
                merchantIds,
            ),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            merchantIds
                ? supabase
                      .from('merchants')
                      .select('*', { count: 'exact', head: true })
                      .in('id', merchantIds)
                : supabase.from('merchants').select('*', { count: 'exact', head: true }),
            supabase.from('couriers').select('*', { count: 'exact', head: true }),
            merchantIds
                ? supabase
                      .from('products')
                      .select('*', { count: 'exact', head: true })
                      .in('merchant_id', merchantIds)
                : supabase.from('products').select('*', { count: 'exact', head: true }),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase.from('orders').select('total_amount, total_price').eq('status', 'delivered'),
                    from,
                ),
                merchantIds,
            ),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select(`
                    id, order_number, status, total_amount, total_price, created_at,
                    merchant:merchants!orders_merchant_id_fkey(name),
                    consumer:users!orders_consumer_id_fkey(first_name, last_name)
                `)
                        .order('created_at', { ascending: false })
                        .limit(5),
                    from,
                ),
                merchantIds,
            ),
            Promise.all(
                STATUSES.map((s) =>
                    applyMerchantIds(
                        applyCreatedAtFrom(
                            supabase
                                .from('orders')
                                .select('*', { count: 'exact', head: true })
                                .eq('status', s),
                            from,
                        ),
                        merchantIds,
                    ),
                ),
            ),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('payment_status', 'refunded'),
                    from,
                ),
                merchantIds,
            ),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('payment_status', 'failed'),
                    from,
                ),
                merchantIds,
            ),
            // Cap scan size — full table scans were very slow over the tunnel.
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('merchant_id, merchant:merchants!orders_merchant_id_fkey(id, name)')
                        .not('merchant_id', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(400),
                    from,
                ),
                merchantIds,
            ),
            merchantIds
                ? supabase
                      .from('order_items')
                      .select('product_id, product_name, quantity, order_id, orders!inner(merchant_id)')
                      .in('orders.merchant_id', merchantIds)
                      .limit(800)
                : supabase
                      .from('order_items')
                      .select('product_id, product_name, quantity')
                      .limit(800),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('total_amount, total_price, created_at')
                        .eq('status', 'delivered')
                        .order('created_at', { ascending: false })
                        .limit(365),
                    from,
                ),
                merchantIds,
            ),
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
            const amount = Number(
                (row as { total_amount?: number | string; total_price?: number | string }).total_amount ??
                    (row as { total_price?: number | string }).total_price,
            );
            dayMap[day] = (dayMap[day] || 0) + (amount || 0);
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
                range: range || 'this_year',
            },
        };
    }
}
