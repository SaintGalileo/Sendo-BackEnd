import { supabase } from '../../config/supabase';

interface PaginationFilters {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    search?: string;
}

type EmptyList = {
    success: true;
    data: unknown[];
    message: string;
    pagination?: { page: number; limit: number; total: number; totalPages: number };
};

function buildPagination(page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    return { from, to, page, limit };
}

function emptyList(message: string, page = 1, limit = 20): EmptyList {
    return {
        success: true,
        data: [],
        message,
        pagination: { page, limit, total: 0, totalPages: 0 },
    };
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    const msg = String(error.message || '').toLowerCase();
    return (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.code === 'PGRST204' ||
        msg.includes('does not exist') ||
        msg.includes('could not find') ||
        msg.includes('schema cache')
    );
}

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function merchantName(row: Record<string, unknown>): string {
    const m = row.merchant as { name?: string } | null | undefined;
    return String(m?.name ?? row.store_name ?? row.merchant_name ?? row.provider ?? '—');
}

function orderTotal(row: Record<string, unknown>): number {
    return num(row.total_amount ?? row.total_price ?? row.total ?? row.amount);
}

function orderTax(row: Record<string, unknown>): number {
    return num(row.tax_amount ?? row.tax ?? row.vat ?? row.vat_amount);
}

function orderStatus(row: Record<string, unknown>): string {
    return String(row.order_status ?? row.status ?? '—');
}

function applyDateRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
    query: T,
    dateFrom?: string,
    dateTo?: string,
): T {
    let q = query;
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);
    return q;
}

/** Try `withdrawals` then `withdraw_requests`; filter store vs courier via type/role. */
async function queryWithdrawTable(
    type: 'store' | 'courier',
    filters: PaginationFilters,
) {
    const { from, to, page, limit } = buildPagination(filters.page, filters.limit);
    const tables = ['withdrawals', 'withdraw_requests'] as const;
    const typeValues =
        type === 'store'
            ? ['store', 'merchant', 'vendor', 'restaurant']
            : ['courier', 'delivery', 'deliveryman', 'rider'];

    for (const table of tables) {
        // Prefer explicit type column
        let typedQuery = supabase
            .from(table)
            .select('*', { count: 'exact' })
            .in('type', typeValues)
            .order('created_at', { ascending: false })
            .range(from, to);

        typedQuery = applyDateRange(typedQuery, filters.dateFrom, filters.dateTo);
        if (filters.status) typedQuery = typedQuery.eq('status', filters.status);

        const typed = await typedQuery;
        if (!typed.error) {
            const total = typed.count || 0;
            return {
                success: true as const,
                data: typed.data || [],
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
            };
        }

        // Column may be `role` instead of `type`
        if (!isMissingRelation(typed.error)) {
            let roleQuery = supabase
                .from(table)
                .select('*', { count: 'exact' })
                .in('role', typeValues)
                .order('created_at', { ascending: false })
                .range(from, to);

            roleQuery = applyDateRange(roleQuery, filters.dateFrom, filters.dateTo);
            if (filters.status) roleQuery = roleQuery.eq('status', filters.status);

            const roleResult = await roleQuery;
            if (!roleResult.error) {
                const total = roleResult.count || 0;
                return {
                    success: true as const,
                    data: roleResult.data || [],
                    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
                };
            }

            // Table exists but filter columns missing — return unfiltered page with honest message
            if (!isMissingRelation(roleResult.error)) {
                let fallback = supabase
                    .from(table)
                    .select('*', { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(from, to);
                fallback = applyDateRange(fallback, filters.dateFrom, filters.dateTo);
                const fb = await fallback;
                if (!fb.error) {
                    const total = fb.count || 0;
                    return {
                        success: true as const,
                        data: fb.data || [],
                        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
                        message: `Could not filter ${table} by ${type}; returned unfiltered rows`,
                    };
                }
            }
        }
    }

    return emptyList('Withdrawals / withdraw_requests table not available yet', page, limit);
}

export class AdminTransactionsService {
    async getTransactionReport(dateFrom?: string, dateTo?: string) {
        let query = supabase
            .from('orders')
            .select('total_amount, delivery_fee, order_status, payment_status, payment_method, created_at')
            .eq('order_status', 'delivered');

        query = applyDateRange(query, dateFrom, dateTo);

        const { data, error } = await query;
        if (error) return { success: false, message: error.message, data: null };

        const totalRevenue = (data || []).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
        const totalDeliveryFees = (data || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);

        return {
            success: true,
            data: {
                totalRevenue,
                totalDeliveryFees,
                totalOrders: data?.length || 0,
                adminCommission: totalRevenue * 0.1,
            },
        };
    }

    async getWithdrawRequests(type: 'store' | 'courier', page = 1, limit = 20) {
        return queryWithdrawTable(type, { page, limit });
    }

    async getAccountTransactions(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        query = applyDateRange(query, filters.dateFrom, filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return emptyList('Transactions table not available yet', page, limit);
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async createAccountTransaction(body: Record<string, unknown>) {
        const amount = num(body.amount);
        if (!amount && body.amount !== 0) {
            return { success: false, message: 'amount is required', data: null };
        }

        const payload: Record<string, unknown> = {
            amount,
            type: body.type ?? 'credit',
            note: body.note ?? body.description ?? null,
            description: body.description ?? body.note ?? null,
            reference: body.reference ?? null,
            status: body.status ?? 'completed',
            collect_from: body.collect_from ?? body.collectFrom ?? null,
            source_name: body.source_name ?? body.sourceName ?? null,
            source_type: body.source_type ?? body.sourceType ?? body.type ?? null,
        };

        // Drop nulls so missing columns are less likely to fail inserts
        for (const key of Object.keys(payload)) {
            if (payload[key] === null || payload[key] === undefined) delete payload[key];
        }

        const { data, error } = await supabase
            .from('transactions')
            .insert(payload)
            .select('*')
            .maybeSingle();

        if (error) {
            if (isMissingRelation(error)) {
                return {
                    success: false,
                    message: 'Transactions table not available yet',
                    data: null,
                };
            }
            // Retry with a minimal payload if some columns don't exist
            const minimal = { amount, type: payload.type, note: payload.note ?? payload.description };
            const retry = await supabase.from('transactions').insert(minimal).select('*').maybeSingle();
            if (retry.error) {
                return {
                    success: false,
                    message: retry.error.message || error.message,
                    data: null,
                };
            }
            return { success: true, data: retry.data };
        }

        return { success: true, data };
    }

    async getStoreWithdrawals(filters: PaginationFilters) {
        return queryWithdrawTable('store', filters);
    }

    async getCourierWithdrawals(filters: PaginationFilters) {
        return queryWithdrawTable('courier', filters);
    }

    async getStoreDisbursements(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('disbursements')
            .select('*', { count: 'exact' })
            .eq('type', 'store')
            .order('created_at', { ascending: false })
            .range(from, to);

        query = applyDateRange(query, filters.dateFrom, filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return emptyList('Disbursements table not available yet', page, limit);
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getCourierDisbursements(filters: PaginationFilters) {
        const { from, to, page, limit } = buildPagination(filters.page, filters.limit);

        let query = supabase
            .from('disbursements')
            .select('*', { count: 'exact' })
            .eq('type', 'courier')
            .order('created_at', { ascending: false })
            .range(from, to);

        query = applyDateRange(query, filters.dateFrom, filters.dateTo);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error, count } = await query;

        if (error) {
            return emptyList('Disbursements table not available yet', page, limit);
        }

        const total = count || 0;
        return {
            success: true,
            data: data || [],
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getCourierEarnings() {
        const { data: earnings, error } = await supabase
            .from('courier_earnings')
            .select(`
                *,
                courier:couriers(
                    id,
                    name,
                    user:users!couriers_user_id_fkey(first_name, last_name)
                )
            `)
            .order('created_at', { ascending: false })
            .limit(200);

        if (!error && earnings) {
            const mapped = (earnings || []).map((row: Record<string, unknown>) => {
                const courier = row.courier as Record<string, unknown> | undefined;
                const user = courier?.user as Record<string, unknown> | undefined;
                const courierName =
                    String(courier?.name || '') ||
                    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
                    'Courier';
                return {
                    ...row,
                    courier_name: courierName,
                    method: row.method ?? row.payment_method ?? null,
                    reference: row.reference ?? row.description ?? null,
                };
            });
            return { success: true, data: mapped };
        }

        const txResult = await supabase
            .from('transactions')
            .select('*')
            .or('source_type.eq.courier,type.eq.courier')
            .order('created_at', { ascending: false })
            .limit(200);

        if (!txResult.error && txResult.data) {
            return {
                success: true,
                data: txResult.data.map((row: Record<string, unknown>) => ({
                    ...row,
                    courier_name: row.source_name ?? row.collect_from ?? 'Courier',
                    method: row.note ?? row.type,
                    reference: row.reference ?? row.description,
                })),
            };
        }

        return { success: true, data: [] };
    }

    async createCourierEarning(body: Record<string, unknown>) {
        const courierId = String(body.courier_id || body.courierId || '').trim();
        const amount = num(body.amount);
        if (!courierId) return { success: false, message: 'courier_id is required', data: null };
        if (!amount && body.amount !== 0) return { success: false, message: 'amount is required', data: null };

        const payload: Record<string, unknown> = {
            courier_id: courierId,
            amount,
            method: body.method ?? null,
            reference: body.reference ?? body.ref ?? null,
            description: body.note ?? body.description ?? null,
        };
        for (const key of Object.keys(payload)) {
            if (payload[key] === null || payload[key] === undefined) delete payload[key];
        }

        const { data, error } = await supabase
            .from('courier_earnings')
            .insert([payload])
            .select('*')
            .maybeSingle();

        if (!error && data) {
            return { success: true, message: 'Courier earning recorded', data };
        }

        return this.createAccountTransaction({
            amount,
            type: 'credit',
            source_type: 'courier',
            source_name: courierId,
            reference: body.reference ?? body.ref,
            note: body.method,
            description: body.reference ?? body.ref,
        });
    }

    async getDayWiseReport(dateFrom?: string, dateTo?: string) {
        let query = supabase
            .from('orders')
            .select('total_amount, delivery_fee, order_status, created_at')
            .eq('order_status', 'delivered');

        query = applyDateRange(query, dateFrom, dateTo);

        const { data, error } = await query;
        if (error) return { success: false, message: error.message, data: null };

        const dayMap: Record<string, { date: string; orders: number; revenue: number; delivery_fees: number }> = {};
        for (const order of data || []) {
            const day = order.created_at?.slice(0, 10) || 'unknown';
            if (!dayMap[day]) dayMap[day] = { date: day, orders: 0, revenue: 0, delivery_fees: 0 };
            dayMap[day].orders += 1;
            dayMap[day].revenue += Number(order.total_amount) || 0;
            dayMap[day].delivery_fees += Number(order.delivery_fee) || 0;
        }

        return { success: true, data: Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)) };
    }

    async getItemWiseReport() {
        const { data, error } = await supabase
            .from('order_items')
            .select('item_id, item_name, quantity, price, total');

        if (error) return { success: false, message: error.message, data: null };

        const itemMap: Record<string, { item_id: string; item_name: string; total_quantity: number; total_sales: number }> = {};
        for (const item of data || []) {
            const key = item.item_id || item.item_name || 'unknown';
            if (!itemMap[key]) {
                itemMap[key] = { item_id: item.item_id, item_name: item.item_name, total_quantity: 0, total_sales: 0 };
            }
            itemMap[key].total_quantity += Number(item.quantity) || 0;
            itemMap[key].total_sales += Number(item.total || item.price) || 0;
        }

        return { success: true, data: Object.values(itemMap) };
    }

    async getStoreWiseReport() {
        const { data, error } = await supabase
            .from('orders')
            .select('store_id, store_name, total_amount, delivery_fee, order_status')
            .eq('order_status', 'delivered');

        if (error) return { success: false, message: error.message, data: null };

        const storeMap: Record<string, { store_id: string; store_name: string; total_orders: number; total_revenue: number }> = {};
        for (const order of data || []) {
            const key = order.store_id || 'unknown';
            if (!storeMap[key]) {
                storeMap[key] = { store_id: order.store_id, store_name: order.store_name, total_orders: 0, total_revenue: 0 };
            }
            storeMap[key].total_orders += 1;
            storeMap[key].total_revenue += Number(order.total_amount) || 0;
        }

        return { success: true, data: Object.values(storeMap) };
    }

    async getDisbursementReport() {
        const { data, error } = await supabase
            .from('disbursements')
            .select('*');

        if (error) {
            return { success: true, data: [], message: 'Disbursements table not available yet' };
        }

        return { success: true, data: data || [] };
    }

    // ── B1 report endpoints ──────────────────────────────────────────────

    async getOrderReport(dateFrom?: string, dateTo?: string) {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    id, order_number, order_status, status, total_amount, total_price,
                    tax_amount, tax, vat, payment_status, created_at, merchant_id,
                    merchant:merchants!orders_merchant_id_fkey(id, name, type)
                `)
                .order('created_at', { ascending: false })
                .limit(2000);

            query = applyDateRange(query, dateFrom, dateTo);

            const { data, error } = await query;
            if (error) {
                // Fallback without join / optional tax columns
                let plain = supabase
                    .from('orders')
                    .select('id, order_number, order_status, total_amount, created_at, merchant_id')
                    .order('created_at', { ascending: false })
                    .limit(2000);
                plain = applyDateRange(plain, dateFrom, dateTo);
                const fallback = await plain;
                if (fallback.error) {
                    return emptyList(fallback.error.message || 'Orders table not available');
                }
                const rows = (fallback.data || []).map((o: Record<string, unknown>, i: number) => ({
                    sl: i + 1,
                    order_number: o.order_number ?? o.id,
                    orderId: o.order_number ?? o.id,
                    merchant: '—',
                    store: '—',
                    status: orderStatus(o),
                    total: orderTotal(o),
                    orderAmount: orderTotal(o),
                    tax: 0,
                    payment_status: o.payment_status ?? '—',
                    paymentStatus: o.payment_status ?? '—',
                    created_at: o.created_at,
                    customer: '—',
                    action: '',
                }));
                return { success: true, data: rows };
            }

            const rows = (data || []).map((o: Record<string, unknown>, i: number) => {
                const name = merchantName(o);
                return {
                    sl: i + 1,
                    order_number: o.order_number ?? o.id,
                    orderId: o.order_number ?? o.id,
                    merchant: name,
                    store: name,
                    status: orderStatus(o),
                    total: orderTotal(o),
                    orderAmount: orderTotal(o),
                    tax: orderTax(o),
                    payment_status: o.payment_status ?? '—',
                    paymentStatus: o.payment_status ?? '—',
                    created_at: o.created_at,
                    customer: '—',
                    action: '',
                };
            });
            return { success: true, data: rows };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build order report');
        }
    }

    async getExpenseReport(dateFrom?: string, dateTo?: string) {
        try {
            let query = supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2000);

            query = applyDateRange(query, dateFrom, dateTo);

            const { data, error } = await query;
            if (error) {
                return emptyList('Transactions table not available for expense report');
            }

            const expenseLike = (row: Record<string, unknown>) => {
                const hay = [
                    row.type,
                    row.category,
                    row.transaction_type,
                    row.source_type,
                    row.note,
                    row.description,
                ]
                    .map((v) => String(v || '').toLowerCase())
                    .join(' ');
                return (
                    hay.includes('expense') ||
                    hay.includes('debit') ||
                    hay.includes('discount') ||
                    hay.includes('refund') ||
                    hay.includes('coupon')
                );
            };

            const filtered = (data || []).filter((r) => expenseLike(r as Record<string, unknown>));
            if (filtered.length === 0 && (data || []).length > 0) {
                // Columns don't look expense-like — return empty with message rather than dumping all txns
                return emptyList('No expense-type transactions found (type/category columns may not mark expenses)');
            }

            const rows = filtered.map((raw, i) => {
                const r = raw as Record<string, unknown>;
                return {
                    sl: i + 1,
                    orderId: String(r.order_id ?? r.order_number ?? r.reference ?? r.id ?? '—'),
                    type: String(r.type ?? r.category ?? r.transaction_type ?? 'expense'),
                    amount: num(r.amount),
                    action: '',
                    created_at: r.created_at,
                };
            });
            return { success: true, data: rows };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build expense report');
        }
    }

    async getVendorWiseTaxesReport(dateFrom?: string, dateTo?: string) {
        return this.groupTaxesByMerchant({ dateFrom, dateTo, parcelOnly: false });
    }

    async getParcelWiseTaxesReport(dateFrom?: string, dateTo?: string) {
        return this.groupTaxesByMerchant({ dateFrom, dateTo, parcelOnly: true });
    }

    private async groupTaxesByMerchant(opts: {
        dateFrom?: string;
        dateTo?: string;
        parcelOnly: boolean;
        rentalOnly?: boolean;
    }) {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    id, merchant_id, total_amount, total_price, tax_amount, tax, vat,
                    order_status, type, module, created_at,
                    merchant:merchants!orders_merchant_id_fkey(id, name, type)
                `)
                .order('created_at', { ascending: false })
                .limit(4000);

            query = applyDateRange(query, opts.dateFrom, opts.dateTo);

            let { data, error } = await query;
            if (error) {
                const plain = await supabase
                    .from('orders')
                    .select('id, merchant_id, total_amount, tax_amount, order_status, type, module, created_at')
                    .limit(4000);
                if (plain.error) {
                    return emptyList(plain.error.message || 'Orders table not available for tax report');
                }
                data = plain.data as any;
            }

            const rows = (data || []) as Record<string, unknown>[];
            const filtered = rows.filter((o) => {
                const m = o.merchant as { type?: string } | null;
                const mType = String(m?.type || '').toLowerCase();
                const oType = String(o.type || o.module || '').toLowerCase();
                if (opts.parcelOnly) {
                    return mType.includes('parcel') || oType.includes('parcel');
                }
                if (opts.rentalOnly) {
                    return mType.includes('rental') || oType.includes('rental');
                }
                return true;
            });

            const map: Record<
                string,
                { merchant_id: string; vendor: string; tax_amount: number; total_amount: number; orders: number }
            > = {};

            for (const o of filtered) {
                const key = String(o.merchant_id || 'unknown');
                const name = merchantName(o);
                if (!map[key]) {
                    map[key] = {
                        merchant_id: key,
                        vendor: name,
                        tax_amount: 0,
                        total_amount: 0,
                        orders: 0,
                    };
                }
                map[key].tax_amount += orderTax(o);
                map[key].total_amount += orderTotal(o);
                map[key].orders += 1;
            }

            const result = Object.values(map).map((r, i) => ({
                sl: i + 1,
                vendor: r.vendor,
                provider: r.vendor,
                merchant_id: r.merchant_id,
                taxAmount: r.tax_amount,
                tax_amount: r.tax_amount,
                total_amount: r.total_amount,
                totalAmount: r.total_amount,
                orders: r.orders,
                action: '',
            }));

            return { success: true, data: result };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build tax report');
        }
    }

    async getRentalTransactionReport(dateFrom?: string, dateTo?: string) {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    id, order_number, order_status, payment_status, total_amount, total_price,
                    created_at, merchant_id, type, module,
                    merchant:merchants!orders_merchant_id_fkey(id, name, type)
                `)
                .or('type.eq.rental,module.eq.rental')
                .order('created_at', { ascending: false })
                .limit(2000);

            query = applyDateRange(query, dateFrom, dateTo);

            const { data, error } = await query;
            if (error) {
                return emptyList(
                    'Rental transactions not detectable (orders type/module columns may be missing)',
                );
            }

            if (!data?.length) {
                return emptyList('No rental orders found');
            }

            const rows = data.map((o: Record<string, unknown>, i: number) => {
                const provider = merchantName(o);
                const amount = orderTotal(o);
                return {
                    sl: i + 1,
                    trip_id: o.order_number ?? o.id,
                    tripId: o.order_number ?? o.id,
                    id: o.id,
                    provider,
                    provider_name: provider,
                    amount,
                    total_amount: amount,
                    payment_status: o.payment_status ?? '—',
                    paymentStatus: o.payment_status ?? '—',
                    completed_amount: ['delivered', 'completed'].includes(orderStatus(o).toLowerCase())
                        ? amount
                        : 0,
                    admin_earning: amount * 0.1,
                    provider_earning: amount * 0.9,
                    action: '',
                    created_at: o.created_at,
                };
            });
            return { success: true, data: rows };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build rental transaction report');
        }
    }

    async getRentalVehicleReport() {
        try {
            const { data, error } = await supabase
                .from('vehicles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2000);

            if (error) {
                return emptyList('vehicles table not available yet');
            }

            const rows = (data || []).map((raw, i) => {
                const r = raw as Record<string, unknown>;
                return {
                    sl: i + 1,
                    vehicle: String(r.name ?? r.vehicle_name ?? r.model ?? r.plate_number ?? r.id ?? '—'),
                    vehicle_name: r.name ?? r.vehicle_name,
                    trips: num(r.trips ?? r.trip_count),
                    trip_count: num(r.trips ?? r.trip_count),
                    earning: num(r.earning ?? r.total_earning ?? r.earnings),
                    total_earning: num(r.earning ?? r.total_earning ?? r.earnings),
                    action: '',
                };
            });
            return { success: true, data: rows };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build vehicle report');
        }
    }

    async getRentalProviderWiseReport(dateFrom?: string, dateTo?: string) {
        try {
            const txn = await this.getRentalTransactionReport(dateFrom, dateTo);
            if (!txn.success || !Array.isArray(txn.data) || txn.data.length === 0) {
                return emptyList(
                    (txn as EmptyList).message || 'No rental provider data available',
                );
            }

            const map: Record<
                string,
                { provider: string; total_amount: number; trips: number }
            > = {};
            for (const raw of txn.data as Record<string, unknown>[]) {
                const key = String(raw.provider ?? raw.provider_name ?? 'unknown');
                if (!map[key]) map[key] = { provider: key, total_amount: 0, trips: 0 };
                map[key].total_amount += num(raw.total_amount ?? raw.amount);
                map[key].trips += 1;
            }

            const rows = Object.values(map).map((r, i) => ({
                sl: i + 1,
                provider: r.provider,
                total_amount: r.total_amount,
                totalAmount: r.total_amount,
                trips: r.trips,
                action: '',
            }));
            return { success: true, data: rows };
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build provider-wise report');
        }
    }

    async getRentalTripReport(dateFrom?: string, dateTo?: string) {
        try {
            // Prefer dedicated trips table when present
            let tripsQuery = supabase
                .from('trips')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2000);
            tripsQuery = applyDateRange(tripsQuery, dateFrom, dateTo);
            const trips = await tripsQuery;

            if (!trips.error && trips.data) {
                const rows = trips.data.map((raw, i) => {
                    const r = raw as Record<string, unknown>;
                    return {
                        sl: i + 1,
                        trip_id: r.trip_number ?? r.id,
                        tripId: r.trip_number ?? r.id,
                        provider: String(r.provider_name ?? r.provider ?? r.merchant_name ?? '—'),
                        amount: num(r.amount ?? r.total_amount ?? r.fare),
                        total_amount: num(r.amount ?? r.total_amount ?? r.fare),
                        payment_status: r.payment_status ?? '—',
                        paymentStatus: r.payment_status ?? '—',
                        action: '',
                        created_at: r.created_at,
                    };
                });
                return { success: true, data: rows };
            }

            // Fallback: rental-filtered orders as trip rows
            return this.getRentalTransactionReport(dateFrom, dateTo);
        } catch (e: any) {
            return emptyList(e?.message || 'Failed to build trip report');
        }
    }

    async getRentalProviderWiseTaxesReport(dateFrom?: string, dateTo?: string) {
        return this.groupTaxesByMerchant({ dateFrom, dateTo, parcelOnly: false, rentalOnly: true });
    }
}
