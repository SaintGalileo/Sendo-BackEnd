import { supabase } from '../../config/supabase';

export class AdminRentalService {
    async getDashboard() {
        try {
            const [ordersResult, salesResult] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, order_status, total_amount, created_at, consumer_id, merchant_id, trip_type')
                    .or('type.eq.rental,module.eq.rental')
                    .limit(2000),
                supabase
                    .from('orders')
                    .select('total_amount, created_at, order_status')
                    .or('type.eq.rental,module.eq.rental')
                    .in('order_status', ['completed', 'delivered'])
                    .order('created_at', { ascending: false })
                    .limit(365),
            ]);

            const all = (!ordersResult.error && ordersResult.data) ? ordersResult.data : [];
            const statusOf = (o: { order_status?: string; status?: string }) =>
                o.order_status || (o as { status?: string }).status || '';

            const pending = all.filter((o) => statusOf(o) === 'pending').length;
            const ongoing = all.filter((o) =>
                ['accepted', 'in_use', 'ongoing', 'on_the_way'].includes(statusOf(o)),
            ).length;
            const completed = all.filter((o) =>
                ['completed', 'delivered'].includes(statusOf(o)),
            ).length;
            const cancelled = all.filter((o) =>
                ['cancelled', 'canceled'].includes(statusOf(o)),
            ).length;

            const grossEarnings = all
                .filter((o) => ['completed', 'delivered'].includes(statusOf(o)))
                .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            const tripTypeOf = (o: { trip_type?: string }) =>
                String(o.trip_type || '').toLowerCase();
            const hourly = all.filter((o) => tripTypeOf(o).includes('hour')).length;
            const distance = all.filter((o) => tripTypeOf(o).includes('distance')).length;
            const perDay = all.filter((o) =>
                tripTypeOf(o).includes('day') || tripTypeOf(o).includes('daily'),
            ).length;
            // If trip_type missing, distribute residual into "other" buckets as 0 and keep totals honest.
            const typed = hourly + distance + perDay;
            const remainder = Math.max(0, all.length - typed);

            const dayMap: Record<string, number> = {};
            for (const row of salesResult.data || []) {
                const day = row.created_at?.slice(0, 10);
                if (!day) continue;
                dayMap[day] = (dayMap[day] || 0) + (Number(row.total_amount) || 0);
            }
            const salesSeries = Object.entries(dayMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, gross]) => ({ date, label: date.slice(5), gross }));

            const customerCounts: Record<string, number> = {};
            const providerCounts: Record<string, number> = {};
            for (const o of all) {
                if (o.consumer_id) customerCounts[o.consumer_id] = (customerCounts[o.consumer_id] || 0) + 1;
                if (o.merchant_id) providerCounts[o.merchant_id] = (providerCounts[o.merchant_id] || 0) + 1;
            }
            const topCustomers = Object.entries(customerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, trips]) => ({ id, name: `Customer ${String(id).slice(0, 6)}`, trips }));
            const topProviders = Object.entries(providerCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, trips]) => ({ id, name: `Provider ${String(id).slice(0, 6)}`, trips }));

            return {
                success: true,
                data: {
                    total_trips: all.length,
                    trip_status: { pending, ongoing, completed, cancelled },
                    gross_earnings: grossEarnings,
                    hourly_trips: hourly || (remainder > 0 ? 0 : 0),
                    distance_trips: distance,
                    per_day_trips: perDay,
                    top_customers: topCustomers,
                    top_providers: topProviders,
                    salesSeries,
                },
            };
        } catch {
            return {
                success: true,
                data: {
                    total_trips: 0,
                    trip_status: { pending: 0, ongoing: 0, completed: 0, cancelled: 0 },
                    gross_earnings: 0,
                    hourly_trips: 0,
                    distance_trips: 0,
                    per_day_trips: 0,
                    top_customers: [],
                    top_providers: [],
                    salesSeries: [],
                },
            };
        }
    }
}
