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

function orderAmount(row: {
    total_amount?: number | string | null;
    total_price?: number | string | null;
}): number {
    return Number(row.total_amount ?? row.total_price) || 0;
}

function asObj<T extends Record<string, unknown>>(raw: unknown): T | null {
    if (!raw) return null;
    if (Array.isArray(raw)) return (raw[0] as T) || null;
    if (typeof raw === 'object') return raw as T;
    return null;
}

function personName(row: {
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
} | null): string {
    if (!row) return '';
    if (row.name) return String(row.name);
    return `${row.first_name || ''} ${row.last_name || ''}`.trim();
}

export class AdminDashboardService {
    async getOverview(range?: string | null, scope: ScopeFilters = {}) {
        const from = dashboardRangeFrom(range);
        const merchantIds = await merchantIdsForScope(scope);
        const emptyScope = merchantIds && merchantIds.length === 0;

        const emptyPayload = {
            totalOrders: 0,
            totalUsers: 0,
            totalMerchants: 0,
            totalCouriers: 0,
            totalItems: 0,
            totalRevenue: 0,
            recentOrders: [],
            orderStatusCounts: Object.fromEntries(STATUSES.map((s) => [s, 0])),
            topSellingStores: [] as Array<{
                id: string;
                name: string;
                orders: number;
                logo_url?: string | null;
            }>,
            popularStores: [] as Array<{
                id: string;
                name: string;
                likes: number;
                logo_url?: string | null;
            }>,
            topSellingItems: [] as Array<{
                id: string;
                name: string;
                sold: number;
                image_url?: string | null;
            }>,
            mostRatedItems: [] as Array<{
                id: string;
                name: string;
                likes: number;
                image_url?: string | null;
            }>,
            topCouriers: [] as Array<{
                id: string;
                name: string;
                orders: number;
                avatar_url?: string | null;
            }>,
            topCustomers: [] as Array<{
                id: string;
                name: string;
                orders: number;
                avatar_url?: string | null;
            }>,
            salesSeries: [] as Array<{ date: string; label: string; gross: number }>,
            range: range || 'this_year',
        };

        if (emptyScope) {
            return { success: true, data: emptyPayload };
        }

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
            rankedOrdersResult,
            orderItemsResult,
            salesSeriesResult,
            popularMerchantsResult,
        ] = await Promise.all([
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase.from('orders').select('*', { count: 'exact', head: true }),
                    from,
                ),
                merchantIds,
            ),
            // Customers ≈ non-admin users (courier/merchant owners still count as users in pie).
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_admin', false),
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
                    // Canonical amount column is total_price.
                    supabase.from('orders').select('total_price').eq('status', 'delivered'),
                    from,
                ),
                merchantIds,
            ),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select(`
                    id, order_number, status, total_price, created_at,
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
            // One scan for top stores / couriers / customers
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select(`
                            merchant_id,
                            courier_id,
                            consumer_id,
                            merchant:merchants!orders_merchant_id_fkey(id, name, logo_url, rating),
                            courier:couriers!orders_courier_id_fkey(id, name),
                            consumer:users!orders_consumer_id_fkey(id, first_name, last_name, avatar_url)
                        `)
                        .order('created_at', { ascending: false })
                        .limit(500),
                    from,
                ),
                merchantIds,
            ),
            // order_items has no product_name — join products
            (() => {
                let q = supabase.from('order_items').select(`
                          product_id, quantity,
                          product:products(id, name, image_url),
                          orders!inner(merchant_id, created_at)
                      `);
                if (merchantIds) q = q.in('orders.merchant_id', merchantIds);
                if (from) q = q.gte('orders.created_at', from);
                return q.limit(1000);
            })(),
            applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('total_price, created_at')
                        .eq('status', 'delivered')
                        .order('created_at', { ascending: false })
                        .limit(500),
                    from,
                ),
                merchantIds,
            ),
            // Popular stores by rating (fallback to order volume below)
            merchantIds
                ? supabase
                      .from('merchants')
                      .select('id, name, logo_url, rating')
                      .in('id', merchantIds)
                      .limit(24)
                : supabase.from('merchants').select('id, name, logo_url, rating').limit(24),
        ]);

        let revenueRows = revenueResult.data || [];
        if (revenueResult.error) {
            console.error('[dashboard] revenue:', revenueResult.error.message);
            const fb = await applyMerchantIds(
                applyCreatedAtFrom(
                    supabase.from('orders').select('total_amount').eq('status', 'delivered'),
                    from,
                ),
                merchantIds,
            );
            revenueRows = fb.data || [];
        }

        let rankedOrders: any[] = rankedOrdersResult.data || [];
        if (rankedOrdersResult.error) {
            console.error('[dashboard] ranked orders:', rankedOrdersResult.error.message);
            const fb = await applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('merchant_id, courier_id, consumer_id')
                        .order('created_at', { ascending: false })
                        .limit(500),
                    from,
                ),
                merchantIds,
            );
            if (fb.data?.length) rankedOrders = fb.data;
        }

        let orderItemRows: any[] = orderItemsResult.data || [];
        if (orderItemsResult.error) {
            console.error('[dashboard] order items:', orderItemsResult.error.message);
            let q = supabase
                .from('order_items')
                .select('product_id, quantity, orders!inner(merchant_id, created_at)');
            if (merchantIds) q = q.in('orders.merchant_id', merchantIds);
            if (from) q = q.gte('orders.created_at', from);
            const fb = await q.limit(1000);
            if (!fb.error) orderItemRows = fb.data || [];
        }

        if (salesSeriesResult.error) {
            console.error('[dashboard] sales series:', salesSeriesResult.error.message);
        }

        let popularMerchants: any[] = popularMerchantsResult.data || [];
        if (popularMerchantsResult.error) {
            console.error('[dashboard] popular merchants:', popularMerchantsResult.error.message);
            const fb = merchantIds
                ? await supabase
                      .from('merchants')
                      .select('id, name, logo_url')
                      .in('id', merchantIds)
                      .limit(24)
                : await supabase.from('merchants').select('id, name, logo_url').limit(24);
            if (!fb.error) popularMerchants = fb.data || [];
        }

        const totalRevenue = revenueRows.reduce(
            (sum: number, o: { total_amount?: number | string; total_price?: number | string }) =>
                sum + orderAmount(o),
            0,
        );

        const orderStatusCounts: Record<string, number> = {};
        STATUSES.forEach((s, i) => {
            orderStatusCounts[s] = statusResults[i]?.count || 0;
        });
        orderStatusCounts.refunded = refundedPayResult.count || 0;
        orderStatusCounts.failed = failedPayResult.count || 0;

        const storeOrderMap: Record<
            string,
            { id: string; name: string; orders: number; logo_url?: string | null }
        > = {};
        const courierOrderMap: Record<
            string,
            { id: string; name: string; orders: number; avatar_url?: string | null }
        > = {};
        const customerOrderMap: Record<
            string,
            { id: string; name: string; orders: number; avatar_url?: string | null }
        > = {};

        for (const o of rankedOrders) {
            const merchant = asObj<{
                id?: string;
                name?: string;
                logo_url?: string | null;
            }>(o.merchant);
            const mid = merchant?.id || o.merchant_id;
            if (mid) {
                if (!storeOrderMap[mid]) {
                    storeOrderMap[mid] = {
                        id: mid,
                        name: merchant?.name || 'Store',
                        orders: 0,
                        logo_url: merchant?.logo_url || null,
                    };
                }
                storeOrderMap[mid].orders++;
                if (!storeOrderMap[mid].logo_url && merchant?.logo_url) {
                    storeOrderMap[mid].logo_url = merchant.logo_url;
                }
            }

            const courier = asObj<{ id?: string; name?: string }>(o.courier);
            const cid = courier?.id || o.courier_id;
            if (cid) {
                if (!courierOrderMap[cid]) {
                    courierOrderMap[cid] = {
                        id: cid,
                        name: courier?.name || `Courier ${String(cid).slice(0, 6)}`,
                        orders: 0,
                    };
                }
                courierOrderMap[cid].orders++;
            }

            const consumer = asObj<{
                id?: string;
                first_name?: string;
                last_name?: string;
                avatar_url?: string | null;
            }>(o.consumer);
            const uid = consumer?.id || o.consumer_id;
            if (uid) {
                if (!customerOrderMap[uid]) {
                    customerOrderMap[uid] = {
                        id: uid,
                        name: personName(consumer) || `Customer ${String(uid).slice(0, 6)}`,
                        orders: 0,
                        avatar_url: consumer?.avatar_url || null,
                    };
                }
                customerOrderMap[uid].orders++;
            }
        }

        const topSellingStoresRaw = Object.values(storeOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        // Hydrate names/logos when ranking came from a join-less fallback.
        const needStoreHydration = topSellingStoresRaw.some(
            (s) => s.name === 'Store' || !s.logo_url,
        );
        if (needStoreHydration && topSellingStoresRaw.length) {
            const ids = topSellingStoresRaw.map((s) => s.id);
            const { data: merchants } = await supabase
                .from('merchants')
                .select('id, name, logo_url')
                .in('id', ids);
            for (const m of merchants || []) {
                const row = storeOrderMap[m.id];
                if (!row) continue;
                if (m.name) row.name = m.name;
                if (m.logo_url) row.logo_url = m.logo_url;
            }
        }

        const topSellingStores = Object.values(storeOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        // Hydrate courier / customer names when missing
        const topCouriersDraft = Object.values(courierOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);
        if (topCouriersDraft.some((c) => c.name.startsWith('Courier '))) {
            const ids = topCouriersDraft.map((c) => c.id);
            const { data: rows } = await supabase.from('couriers').select('id, name').in('id', ids);
            for (const c of rows || []) {
                if (courierOrderMap[c.id] && c.name) courierOrderMap[c.id].name = c.name;
            }
        }
        const topCustomersDraft = Object.values(customerOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);
        if (topCustomersDraft.some((c) => c.name.startsWith('Customer '))) {
            const ids = topCustomersDraft.map((c) => c.id);
            const { data: rows } = await supabase
                .from('users')
                .select('id, first_name, last_name, avatar_url')
                .in('id', ids);
            for (const u of rows || []) {
                const row = customerOrderMap[u.id];
                if (!row) continue;
                const n = personName(u);
                if (n) row.name = n;
                if (u.avatar_url) row.avatar_url = u.avatar_url;
            }
        }

        const topCouriers = Object.values(courierOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        const topCustomers = Object.values(customerOrderMap)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        const ratedPopular = popularMerchants
            .map((m: any) => ({
                id: m.id as string,
                name: (m.name as string) || 'Store',
                likes: Math.round(Number(m.rating || 0) * 10) / 10,
                logo_url: (m.logo_url as string) || null,
            }))
            .filter((m) => m.likes > 0)
            .sort((a, b) => b.likes - a.likes);
        const popularStores =
            ratedPopular.length > 0
                ? ratedPopular.slice(0, 6)
                : topSellingStores.map((s) => ({
                      id: s.id,
                      name: s.name,
                      likes: s.orders,
                      logo_url: s.logo_url || null,
                  }));

        // Items sold — apply range filter via joined orders.created_at when present
        const itemSoldMap: Record<
            string,
            { id: string; name: string; sold: number; image_url?: string | null }
        > = {};
        for (const oi of orderItemRows) {
            const orderJoin = asObj<{ created_at?: string; merchant_id?: string }>(
                (oi as any).orders,
            );
            if (from && orderJoin?.created_at && orderJoin.created_at < from) continue;

            const product = asObj<{ id?: string; name?: string; image_url?: string | null }>(
                (oi as any).product,
            );
            const key = product?.id || oi.product_id;
            if (!key) continue;
            if (!itemSoldMap[key]) {
                itemSoldMap[key] = {
                    id: String(key),
                    name: product?.name || 'Item',
                    sold: 0,
                    image_url: product?.image_url || null,
                };
            }
            itemSoldMap[key].sold += Number(oi.quantity) || 1;
            if (!itemSoldMap[key].image_url && product?.image_url) {
                itemSoldMap[key].image_url = product.image_url;
            }
        }
        const topSellingItems = Object.values(itemSoldMap)
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 6);

        // No product-level reviews table — surface top sellers as "most rated" by volume.
        const mostRatedItems = topSellingItems.map((i) => ({
            id: i.id,
            name: i.name,
            likes: i.sold,
            image_url: i.image_url || null,
        }));

        let salesRows = salesSeriesResult.data || [];
        if (salesSeriesResult.error) {
            const fb = await applyMerchantIds(
                applyCreatedAtFrom(
                    supabase
                        .from('orders')
                        .select('total_amount, created_at')
                        .eq('status', 'delivered')
                        .order('created_at', { ascending: false })
                        .limit(500),
                    from,
                ),
                merchantIds,
            );
            salesRows = fb.data || [];
        }

        const dayMap: Record<string, number> = {};
        for (const row of salesRows) {
            const day = row.created_at?.slice(0, 10);
            if (!day) continue;
            dayMap[day] = (dayMap[day] || 0) + orderAmount(row);
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
                mostRatedItems,
                topCouriers,
                topCustomers,
                salesSeries,
                range: range || 'this_year',
            },
        };
    }
}
